import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { TranslateService } from '@ngx-translate/core';
import { NavController } from 'ionic-angular';
import * as _ from 'lodash';
import * as moment from 'moment';

// Proviers
import { ActionSheetProvider } from '../../../../providers/action-sheet/action-sheet';
import { AppProvider } from '../../../../providers/app/app';
import { CurrencyProvider } from '../../../../providers/currency/currency';
import { ExternalLinkProvider } from '../../../../providers/external-link/external-link';
import { Logger } from '../../../../providers/logger/logger';
import { PersistenceProvider } from '../../../../providers/persistence/persistence';
import { PlatformProvider } from '../../../../providers/platform/platform';
import { PopupProvider } from '../../../../providers/popup/popup';
import { ProfileProvider } from '../../../../providers/profile/profile';
import { RateProvider } from '../../../../providers/rate/rate';
import { SimplexProvider } from '../../../../providers/simplex/simplex';
import { WalletProvider } from '../../../../providers/wallet/wallet';

@Component({
  selector: 'page-simplex-buy',
  templateUrl: 'simplex-buy.html'
})
export class SimplexBuyPage {
  public isOpenSelector: boolean;
  public wallet;
  public wallets: any[];
  public quoteForm: FormGroup;
  public cryptoAmount: number;
  public fiatBaseAmount: number;
  public fiatTotalAmount: number;
  public fiatCurrency: string;
  public okText: string;
  public cancelText: string;
  public validUntil: string;
  public showLoading: boolean;
  public minFiatAmount: number;
  public maxFiatAmount: number;
  public supportedFiatAltCurrencies: string[];

  private quoteId: string;
  private createdOn: string;

  constructor(
    private actionSheetProvider: ActionSheetProvider,
    private appProvider: AppProvider,
    private currencyProvider: CurrencyProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private fb: FormBuilder,
    private inAppBrowser: InAppBrowser,
    private logger: Logger,
    private navCtrl: NavController,
    private persistenceProvider: PersistenceProvider,
    private platformProvider: PlatformProvider,
    private popupProvider: PopupProvider,
    private profileProvider: ProfileProvider,
    private rateProvider: RateProvider,
    private simplexProvider: SimplexProvider,
    private translate: TranslateService,
    private walletProvider: WalletProvider
  ) {
    this.wallets = this.profileProvider.getWallets({
      network: 'livenet',
      onlyComplete: true,
      coin: ['btc', 'bch', 'eth'],
      backedUp: true
    });
    this.supportedFiatAltCurrencies = ['USD', 'EUR'];
    this.okText = this.translate.instant('Select');
    this.cancelText = this.translate.instant('Cancel');
    this.showLoading = false;
    this.minFiatAmount = 50;
    this.maxFiatAmount = 20000;

    this.quoteForm = this.fb.group({
      amount: [
        120,
        [Validators.required, Validators.min(50), Validators.max(20000)]
      ],
      altCurrency: ['USD', [Validators.required]]
    });

    this.persistenceProvider.getProfile().then(profile => {
      this.createdOn =
        profile && profile.createdOn
          ? moment(profile.createdOn).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
          : moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    });
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: SimplexBuyPage');
    this.showWallets();
  }

  public showWallets(): void {
    this.isOpenSelector = true;
    const id = this.wallet ? this.wallet.credentials.walletId : null;
    const params = {
      wallets: this.wallets,
      selectedWalletId: id,
      title: this.translate.instant('Select wallet to deposit to')
    };
    const walletSelector = this.actionSheetProvider.createWalletSelector(
      params
    );
    walletSelector.present();
    walletSelector.onDidDismiss(wallet => {
      this.onSelectWalletEvent(wallet);
    });
  }

  private onSelectWalletEvent(wallet): void {
    if (!_.isEmpty(wallet)) this.onWalletSelect(wallet);
    this.isOpenSelector = false;
  }

  public currencyIsFiat(): boolean {
    return (
      this.supportedFiatAltCurrencies.indexOf(
        this.quoteForm.value.altCurrency
      ) > -1
    );
  }

  public onWalletSelect(wallet): void {
    this.setWallet(wallet);
    this.setDefaultValues();
    this.amountChange();
  }

  private setWallet(wallet): void {
    this.wallet = wallet;
  }

  private setDefaultValues() {
    this.quoteForm.controls['amount'].setValue(undefined);
    this.quoteForm.controls['altCurrency'].setValue('USD');
    this.quoteForm.controls['amount'].setValidators([
      Validators.required,
      Validators.min(50),
      Validators.max(20000)
    ]);
    this.minFiatAmount = 50;
    this.maxFiatAmount = 20000;
    this.quoteForm.controls['amount'].setValue(120);
  }

  public altCurrencyChange(): void {
    this.logger.debug(
      'altCurrency changed to: ' + this.quoteForm.value.altCurrency
    );

    if (this.currencyIsFiat()) {
      this.quoteForm.controls['amount'].setValue(undefined);
      this.quoteForm.controls['amount'].setValidators([
        Validators.required,
        Validators.min(50),
        Validators.max(20000)
      ]);
      this.minFiatAmount = 50;
      this.maxFiatAmount = 20000;
      this.quoteForm.controls['amount'].setValue(120);
    } else {
      this.quoteForm.controls['amount'].setValue(undefined);

      let coin = this.quoteForm.value.altCurrency.toLowerCase();
      let alternative = 'USD';
      let min = +(
        this.rateProvider.fromFiat(50, alternative, coin) /
        this.currencyProvider.getPrecision(coin).unitToSatoshi
      ).toFixed(8);
      let max = +(
        this.rateProvider.fromFiat(20000, alternative, coin) /
        this.currencyProvider.getPrecision(coin).unitToSatoshi
      ).toFixed(8);

      this.quoteForm.controls['amount'].setValidators([
        Validators.required,
        Validators.min(min),
        Validators.max(max)
      ]);
      this.minFiatAmount = min;
      this.maxFiatAmount = max;
      this.quoteForm.controls['amount'].setValue(1);
    }

    this.amountChange();
  }

  public amountChange(): void {
    if (this.quoteForm.valid && !_.isEmpty(this.wallet)) {
      this.debounceAmountInput();
    }
  }

  private debounceAmountInput = _.debounce(
    () => {
      this.getSimplexQuote();
    },
    1500,
    {
      leading: true
    }
  );

  public getEvents(): void {
    this.simplexProvider
      .getEvents(this.wallet)
      .then(_data => {})
      .catch(err => {
        this.showError(err);
      });
  }

  private getSimplexQuote(): void {
    this.showLoading = true;
    const data = {
      digital_currency: this.currencyProvider.getChain(this.wallet.coin),
      fiat_currency: this.currencyIsFiat()
        ? this.quoteForm.value.altCurrency
        : 'USD',
      requested_currency: this.quoteForm.value.altCurrency,
      requested_amount: +this.quoteForm.value.amount,
      end_user_id: this.wallet.id // TODO: BitPay id / wallet id??
    };

    this.simplexProvider
      .getQuote(this.wallet, data)
      .then(data => {
        if (data) {
          this.cryptoAmount = data.digital_money.amount;
          this.fiatBaseAmount = data.fiat_money.base_amount;
          this.fiatTotalAmount = data.fiat_money.total_amount;
          this.fiatCurrency = data.fiat_money.currency;
          this.quoteId = data.quote_id;
          this.validUntil = data.valid_until;
          this.showLoading = false;
        }
      })
      .catch(err => {
        this.showError(err);
      });
  }

  simplexPaymentRequest(address: string): Promise<any> {
    const userAgent = this.platformProvider.getUserAgent();
    const data = {
      account_details: {
        app_version_id: this.appProvider.info.version,
        app_install_date: this.createdOn,
        app_end_user_id: this.wallet.id, // TODO: BitPay id / wallet id??
        signup_login: {
          user_agent: userAgent, // Format: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0'
          timestamp: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
        }
      },
      transaction_details: {
        payment_details: {
          quote_id: this.quoteId,
          fiat_total_amount: {
            currency: this.currencyIsFiat()
              ? this.quoteForm.value.altCurrency
              : 'USD',
            amount: this.fiatTotalAmount
          },
          requested_digital_amount: {
            currency: this.currencyProvider.getChain(this.wallet.coin),
            amount: this.cryptoAmount
          },
          destination_wallet: {
            currency: this.currencyProvider.getChain(this.wallet.coin),
            address,
            tag: ''
          },
          original_http_ref_url: 'https://bitpay.com/'
        }
      }
    };

    return this.simplexProvider.paymentRequest(this.wallet, data);
  }

  public simplexPaymentFormSubmission(data) {
    const fiat_total_amount_currency = this.currencyIsFiat()
      ? this.quoteForm.value.altCurrency
      : 'USD';
    const digital_total_amount_currency = this.currencyIsFiat()
      ? this.quoteForm.value.altCurrency
      : 'USD';

    var pageContent =
      '<html><head></head><body><form id="theForm" action=' +
      data.api_host +
      '/payments/new' +
      ' method="post">' +
      '<input type="hidden" name="version" value="' +
      '1' +
      '">' +
      '<input type="hidden" name="partner" value="' +
      data.app_provider_id +
      '">' +
      '<input type="hidden" name="payment_flow_type" value="' +
      'wallet' +
      '">' +
      '<input type="hidden" name="return_url_success" value="' +
      'copay://simplex?success=true&paymentId=' +
      data.payment_id +
      '&quoteId=' +
      this.quoteId +
      '&userId=' +
      this.wallet.id +
      '">' +
      '<input type="hidden" name="return_url_fail" value="' +
      'copay://simplex?success=false&paymentId=' +
      data.payment_id +
      '&quoteId=' +
      this.quoteId +
      '&userId=' +
      this.wallet.id +
      '">' +
      '<input type="hidden" name="quote_id" value="' +
      this.quoteId +
      '">' +
      '<input type="hidden" name="payment_id" value="' +
      data.payment_id +
      '">' +
      '<input type="hidden" name="user_id" value="' +
      this.wallet.id +
      '">' +
      '<input type="hidden" name="destination_wallet[address]" value="' +
      data.address +
      '">' +
      '<input type="hidden" name="destination_wallet[currency]" value="' +
      this.currencyProvider.getChain(this.wallet.coin) +
      '">' +
      '<input type="hidden" name="fiat_total_amount[amount]" value="' +
      this.fiatTotalAmount +
      '">' +
      '<input type="hidden" name="fiat_total_amount[currency]" value="' +
      fiat_total_amount_currency +
      '">' +
      '<input type="hidden" name="digital_total_amount[amount]" value="' +
      this.cryptoAmount +
      '">' +
      '<input type="hidden" name="digital_total_amount[currency]" value="' +
      digital_total_amount_currency +
      '">' +
      '</form><script type="text/javascript">setTimeout(() => {document.getElementById("theForm").submit();}, 200);</script></body></html>';

    console.log(pageContent);

    var pageContentUrl = 'data:text/html;base64,' + btoa(pageContent);

    console.log(pageContentUrl);
    this.logger.info(
      '%%%%%%%%%%%%%%%%%%%%%%% Trying to open through TheWindow!'
    );

    const browser = this.inAppBrowser.create(pageContentUrl, '_system');

    browser.on('loadstop').subscribe(event => {
      this.logger.info('************ loadstop event: ', event);
      // browser.insertCSS({ code: "body{color: red;" });
    });
  }

  public openPopUpConfirmation(): void {
    const title = this.translate.instant('Continue to Simplex');
    const message = this.translate.instant(
      'In order to finish the payment process you will be redirected to Simplex page'
    );
    const okText = this.translate.instant('Continue');
    const cancelText = this.translate.instant('Go back');
    this.popupProvider
      .ionicConfirm(title, message, okText, cancelText)
      .then((res: boolean) => {
        if (res) this.continueToSimplex();
      });
  }

  public continueToSimplex(): void {
    this.walletProvider
      .getAddress(this.wallet, false)
      .then(address => {
        this.simplexPaymentRequest(address)
          .then(req => {
            if (req && req.error && !_.isEmpty(req.error)) {
              this.showError(req.error);
              return;
            }

            let data: any = {
              address,
              api_host: req.api_host,
              app_provider_id: req.app_provider_id,
              order_id: req.order_id,
              payment_id: req.payment_id
            };
            try {
              this.simplexPaymentFormSubmission(data);

              let newData = {
                address,
                created_on: Date.now(),
                crypto_amount: this.cryptoAmount,
                coin: this.currencyProvider.getChain(this.wallet.coin),
                fiat_total_amount: this.fiatTotalAmount,
                fiat_total_amount_currency: this.currencyIsFiat()
                  ? this.quoteForm.value.altCurrency
                  : 'USD',
                order_id: req.order_id,
                payment_id: req.payment_id,
                status: 'paymentRequestSent',
                user_id: this.wallet.id
              };
              this.simplexProvider
                .saveSimplex(newData, null)
                .then(() => {
                  this.logger.debug(
                    'Saved Simplex with status: ' + newData.status
                  );
                  this.navCtrl.popToRoot();
                })
                .catch(err => {
                  this.showError(err);
                });
            } catch (err) {
              this.showError(err);
            }
          })
          .catch(err => {
            this.showError(err);
          });
      })
      .catch(err => {
        return this.showError(err);
      });
  }

  public openExternalLink(url: string) {
    this.externalLinkProvider.open(url);
  }

  private showError(err?) {
    this.showLoading = false;
    let msg = this.translate.instant(
      'Could not create payment request. Please, try again later.'
    );
    if (err) {
      if (_.isString(err)) {
        msg = err;
      } else {
        if (err.error && err.error.error) msg = err.error.error;
        else if (err.message) msg = err.message;
      }
    }

    this.logger.error('Simplex error: ' + msg);

    const title = this.translate.instant('Error');
    const infoSheet = this.actionSheetProvider.createInfoSheet(
      'default-error',
      { msg, title }
    );
    infoSheet.present();
    infoSheet.onDidDismiss(() => {
      this.navCtrl.pop();
    });
  }
}