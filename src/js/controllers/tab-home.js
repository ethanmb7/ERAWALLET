'use strict';

angular.module('copayApp.controllers').controller('tabHomeController',
  function($rootScope, $timeout, $scope, $state, lodash, profileService, walletService, configService, txFormatService, $ionicModal, $log, platformInfo, storageService) {

    var setNotifications = function(notifications) {
      var n = walletService.processNotifications(notifications, 3);
      $scope.notifications = n;
      $scope.notificationsMore = notifications.length > 3 ? notifications.length - 3 : null;
      $timeout(function() {
        $scope.$apply();
      }, 1);
    };

    $scope.updateAllWallets = function() {
      $scope.wallets = profileService.getWallets();
      if (lodash.isEmpty($scope.wallets)) return;

      $timeout(function() {
        var i = $scope.wallets.length;
        var j = 0;
        var timeSpan = 60 * 60 * 24 * 7;
        var notifications = [];

        lodash.each($scope.wallets, function(wallet) {

          walletService.getStatus(wallet, {}, function(err, status) {
            if (err) {
              console.log('[tab-home.js.35:err:]', $log.error(err)); //TODO
              return;
            }
            wallet.status = status;
          });


        });

        $scope.fetchingNotifications = true;
        profileService.getNotifications(3, function(err, n) {
          if (err) {
            console.log('[tab-home.js.35:err:]', $log.error(err)); //TODO
            return;
          }
          $scope.fetchingNotifications = false;
          setNotifications(n);
        })

        $scope.$digest();
      }, 100);
    };

    $scope.updateWallet = function(wallet) {
      $log.debug('Updating wallet:' + wallet.name)
      walletService.getStatus(wallet, {}, function(err, status) {
        if (err) {
          $log.error(err); //TODO
          return;
        }
        wallet.status = status;
        $timeout(function() {
          $scope.$apply();
        }, 1);
      });
    };

    $scope.externalServices = {};
    $scope.nextStep = function() {
      lodash.each(['AmazonGiftCards', 'BitpayCard', 'BuyAndSell'], function(service) {
        storageService.getNextStep(service, function(err, value) {
          $scope.externalServices[service] = value ? true : false;
        });
      });
    };

    $scope.bitpayCardEnabled = true; // TODO

    var listeners = [
      $rootScope.$on('bwsEvent', function(e, walletId, type, n) {
        var wallet = profileService.getWallet(walletId);
        $scope.updateWallet(wallet);
      }),
      $rootScope.$on('Local/TxAction', function(e, walletId) {
        var wallet = profileService.getWallet(walletId);
        $scope.updateWallet(wallet);
      }),
    ];

    $scope.$on('$destroy', function() {
      lodash.each(listeners, function(x) {
        x();
      });
    });

    configService.whenAvailable(function() {
      var config = configService.getSync();
      var isWindowsPhoneApp = platformInfo.isWP && isCordova;
      $scope.glideraEnabled = config.glidera.enabled && !isWindowsPhoneApp;
      $scope.coinbaseEnabled = config.coinbase.enabled && !isWindowsPhoneApp;
    });

  });
