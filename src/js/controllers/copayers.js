'use strict';

angular.module('copayApp.controllers').controller('copayersController',
  function($scope, $rootScope, $timeout, $log, $ionicModal, profileService, go, notification, platformInfo, gettext, gettextCatalog, $stateParams, $state) {
    var self = this;
    $scope.isCordova = platformInfo.isCordova;
    var isWP = platformInfo.isWP;
    var isAndroid = platformInfo.isAndroid;

    var delete_msg = gettextCatalog.getString('Are you sure you want to delete this wallet?');
    var accept_msg = gettextCatalog.getString('Accept');
    var cancel_msg = gettextCatalog.getString('Cancel');
    var confirm_msg = gettextCatalog.getString('Confirm');

    var _modalDeleteWallet = function() {
      $scope.title = delete_msg;
      $scope.accept_msg = accept_msg;
      $scope.cancel_msg = cancel_msg;
      $scope.confirm_msg = confirm_msg;
      $scope.okAction = doDeleteWallet;
      $scope.loading = false;

      $ionicModal.fromTemplateUrl('views/modals/confirmation.html', {
        scope: $scope,
        animation: 'slide-in-up'
      }).then(function(modal) {
        $scope.confirmationModal = modal;
        $scope.confirmationModal.show();
      });
    };

    var doDeleteWallet = function() {
      var fc = profileService.focusedClient;
      var walletName = fc.credentials.walletName;
      profileService.deleteWalletClient(fc, function(err) {
        if (err) {
          self.error = err.message || err;
          $timeout(function() {
            $scope.$digest();
          });
        } else {
          go.walletHome();
          $timeout(function() {
            notification.success(
              gettextCatalog.getString('Success'),
              gettextCatalog.getString('The wallet "{{walletName}}" was deleted', {
                walletName: walletName
              })
            );
          });
        }
      });
    };

    $scope.deleteWallet = function() {
      var fc = profileService.focusedClient;
      if ($scope.isCordova) {
        navigator.notification.confirm(
          delete_msg,
          function(buttonIndex) {
            if (buttonIndex == 1) {
              doDeleteWallet();
            }
          },
          confirm_msg, [accept_msg, cancel_msg]
        );
      } else {
        _modalDeleteWallet();
      }
    };

    $scope.copySecret = function() {
      if ($scope.isCordova) {
        window.cordova.plugins.clipboard.copy(secret);
        window.plugins.toast.showShortCenter(gettextCatalog.getString('Copied to clipboard'));
      }
    };

    $scope.shareSecret = function() {
      if ($scope.isCordova) {
        var message = gettextCatalog.getString('Join my Copay wallet. Here is the invitation code: {{secret}} You can download Copay for your phone or desktop at https://copay.io', {
          secret: secret
        });
        window.plugins.socialsharing.share(message, gettextCatalog.getString('Invitation to share a Copay Wallet'), null, null);
      }
    };


  if (!$stateParams.walletId) {
    $log.debug('No wallet provided...back to home');
    return $state.transitionTo('tabs.home')
  }

  var wallet = profileService.getWallet($stateParams.walletId);
  var secret;
  try {
    secret = wallet.status.wallet.secret;
  } catch (e) {};


  $scope.wallet = wallet;
  $scope.secret = secret;
});
