'use strict';

angular.module('copayApp.controllers').controller('wordsController',
  function($rootScope, $scope, $timeout, profileService, go, gettext, confirmDialog, notification) {

    var msg = gettext('Are you sure you want to delete the backup words?');
    var successMsg = gettext('Backup words deleted');

    $scope.isja = function(word) {
      return word.match(/[\u3041-\u308f]/) != null;
    };

    this.done = function() {
      $rootScope.$emit('Local/BackupDone');
    };

    this.delete = function() {
      var fc = profileService.focusedClient;
      confirmDialog.show(msg, function(ok) {
        if (ok) {
          fc.clearMnemonic();
          profileService.updateCredentialsFC(function() {
            notification.success(successMsg);
            go.walletHome();
          });
        }
      });
    };

    var fc = profileService.focusedClient;
    var words = fc.getMnemonic();

    if (words) {
      this.mnemonicWords = words.split(/[\u3000\s]+/);
      this.mnemonicHasPassphrase = fc.mnemonicHasPassphrase();
      this.useIdeograms = words.indexOf("\u3000") >= 0;
    }

  });
