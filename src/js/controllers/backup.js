'use strict';

angular.module('copayApp.controllers').controller('backupController',
  function($rootScope, $scope, $timeout, $log, $state, $stateParams, $ionicPopup, uxLanguage, lodash, fingerprintService, platformInfo, configService, profileService, gettext, bwcService, walletService, ongoingProcess) {

    var wallet = profileService.getWallet($stateParams.walletId);
    var xPriv6;
    $scope.walletName = wallet.credentials.walletName;
    $scope.n = wallet.n;

    $scope.credentialsEncrypted = wallet.isPrivKeyEncrypted;

    var isDeletedSeed = function() {
      if (lodash.isEmpty(wallet.credentials.mnemonic) && lodash.isEmpty(wallet.credentials.mnemonicEncrypted))
        return true;
      return false;
    };

    $scope.init = function() {
      $scope.deleted = isDeletedSeed();
      if ($scope.deleted) return;

      walletService.getKey(wallet, function(err, mnemonics, xpriv) {
        if (err) {
          $state.go('preferences');
          return;
        }
        $scope.credentialsEncrypted = false;
        $scope.initFlow(mnemonics, xpriv);
      });
    };

    var shuffledWords = function(words) {
      var sort = lodash.sortBy(words);

      return lodash.map(sort, function(w) {
        return {
          word: w,
          selected: false
        };
      });
    };

    $scope.initFlow = function() {
      var words = wallet.getMnemonic();
      xPriv6 = wallet.credentials.xPrivKey.substr(wallet.credentials.xPrivKey.length - 6);

      $scope.mnemonicWords = words.split(/[\u3000\s]+/);
      $scope.shuffledMnemonicWords = shuffledWords($scope.mnemonicWords);
      $scope.mnemonicHasPassphrase = wallet.mnemonicHasPassphrase();
      $scope.useIdeograms = words.indexOf("\u3000") >= 0;
      $scope.passphrase = '';
      $scope.customWords = [];
      $scope.step = 1;
      $scope.selectComplete = false;
      $scope.backupError = false;

      words = lodash.repeat('x', 300);
      $timeout(function() {
        $scope.$apply();
      }, 10);
    };

    $scope.goBack = function() {
      if ($scope.step == 1) {
        if ($stateParams.fromOnboarding) $state.go('onboarding.backupRequest');
        else $state.go('wallet.preferences');
      }
      else {
        $scope.goToStep($scope.step - 1);
      }
    };

    var backupError = function(err) {
      ongoingProcess.set('validatingWords', false);
      $log.debug('Failed to verify backup: ', err);
      $scope.backupError = true;

      $timeout(function() {
        $scope.$apply();
      }, 1);
    };

    var openPopup = function() {
      var confirmBackupPopup = $ionicPopup.show({
        templateUrl: "views/includes/confirmBackupPopup.html",
        scope: $scope,
      });

      $scope.closePopup = function(val) {
        if (val) {
          confirmBackupPopup.close();
          if ($stateParams.fromOnboarding) $state.go('onboarding.disclaimer');
          else $state.go('tabs.home')
        }
        else {
          confirmBackupPopup.close();
          $scope.goToStep(1);
        }
      };
    }

    var confirm = function(cb) {
      $scope.backupError = false;

      var customWordList = lodash.pluck($scope.customWords, 'word');

      if (!lodash.isEqual($scope.mnemonicWords, customWordList)) {
        return cb('Mnemonic string mismatch');
      }

      $timeout(function() {
        if ($scope.mnemonicHasPassphrase) {
          var walletClient = bwcService.getClient();
          var separator = $scope.useIdeograms ? '\u3000' : ' ';
          var customSentence = customWordList.join(separator);
          var passphrase = $scope.passphrase || '';

          try {
            walletClient.seedFromMnemonic(customSentence, {
              network: wallet.credentials.network,
              passphrase: passphrase,
              account: wallet.credentials.account
            });
          } catch (err) {
            walletClient.credentials.xPrivKey = lodash.repeat('x', 64);
            return cb(err);
          }

          if (walletClient.credentials.xPrivKey.substr(walletClient.credentials.xPrivKey-6) != xPriv6) {
            walletClient.credentials.xPrivKey = lodash.repeat('x', 64);
            return cb('Private key mismatch');
          }
        }

        $rootScope.$emit('Local/BackupDone');
        return cb();
      }, 1);
    };

    var finalStep = function() {
      ongoingProcess.set('validatingWords', true);
      confirm(function(err) {
        xPriv6 = lodash.repeat('x', 6);
        ongoingProcess.set('validatingWords', false);
        if (err) {
          backupError(err);
        }
        $timeout(function() {
          openPopup();
          return;
        }, 1);
      });
    };

    $scope.goToStep = function(n) {
      if (n == 1)
        $scope.initFlow();
      if (n == 2)
        $scope.step = 2;
      if (n == 3) {
        if (!$scope.mnemonicHasPassphrase)
          finalStep();
        else
          $scope.step = 3;
      }
      if (n == 4)
        finalStep();
    };

    $scope.addButton = function(index, item) {
      var newWord = {
        word: item.word,
        prevIndex: index
      };
      $scope.customWords.push(newWord);
      $scope.shuffledMnemonicWords[index].selected = true;
      $scope.shouldContinue();
    };

    $scope.removeButton = function(index, item) {
      if ($scope.loading) return;
      $scope.customWords.splice(index, 1);
      $scope.shuffledMnemonicWords[item.prevIndex].selected = false;
      $scope.shouldContinue();
    };

    $scope.shouldContinue = function() {
      if ($scope.customWords.length == $scope.shuffledMnemonicWords.length)
        $scope.selectComplete = true;
      else
        $scope.selectComplete = false;
    };


    $scope.$on('$destroy', function() {
      walletService.lock(wallet);
    });

  });
