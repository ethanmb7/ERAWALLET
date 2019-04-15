import { Component } from '@angular/core';
import { NavParams } from 'ionic-angular';
import { Logger } from '../../../providers/logger/logger';

import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

// providers
import { ConfigProvider } from '../../../providers/config/config';
import { EmailNotificationsProvider } from '../../../providers/email-notifications/email-notifications';
import { ExternalLinkProvider } from '../../../providers/external-link/external-link';
import { HttpRequestsProvider } from '../../../providers/http-requests/http-requests';
import { IncomingDataProvider } from '../../../providers/incoming-data/incoming-data';

@Component({
  selector: 'page-contact-email',
  templateUrl: 'contact-email.html'
})
export class ContactEmailPage {
  public emailForm: FormGroup;
  public coin: string;
  private testStr: string;
  private invoiceId: string;
  constructor(
    private logger: Logger,
    private navParam: NavParams,
    public formBuilder: FormBuilder,
    private httpNative: HttpRequestsProvider,
    private incomingDataProvider: IncomingDataProvider,
    private configProvider: ConfigProvider,
    private emailProvider: EmailNotificationsProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private translate: TranslateService
  ) {
    this.testStr = this.navParam.data.testStr;
    this.invoiceId = this.navParam.data.invoiceId;
    this.coin = this.navParam.data.coin;
    this.emailForm = formBuilder.group({
      email: [
        '',
        Validators.compose([
          Validators.pattern(
            /^(?:[\w!#$%&'*-=?^`{|}~]+\.)*[\w!#$%&'*\-=?^`{|}~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])]))$/
          ),
          Validators.required
        ])
      ]
    });
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: Contact Email Page');
    this.updateConfig();
  }

  private updateConfig() {
    const config = this.configProvider.get();
    this.emailForm.setValue({
      email: this.emailProvider.getEmailIfEnabled(config) || ''
    });
  }

  public openPrivacyPolicy() {
    const url = 'https://bitpay.com/about/privacy';
    const optIn = true;
    const title = null;
    const message = this.translate.instant('View Privacy Policy');
    const okText = this.translate.instant('Open');
    const cancelText = this.translate.instant('Go Back');
    this.externalLinkProvider.open(
      url,
      optIn,
      title,
      message,
      okText,
      cancelText
    );
  }

  private parseError(err: any): string {
    if (!err) return 'Unknow Error';
    if (!err.error) return err.message ? err.message : 'Unknow Error';

    const parsedError = err.error.error_description
      ? err.error.error_description
      : err.error.error && err.error.error.message
      ? err.error.error.message
      : err.error;
    return parsedError;
  }

  public async setBuyerProvidedEmail() {
    const url = `https://${
      this.testStr
    }bitpay.com/invoiceData/setBuyerProvidedEmail`;

    const dataSrc = {
      buyerProvidedEmail: this.emailForm.value.email,
      invoiceId: this.invoiceId
    };

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    // Need to add BCH testnet bchtest: payProUrl
    const payProBitcoinUrl: string = `bitcoin:?r=https://${
      this.testStr
    }bitpay.com/i/${this.invoiceId}`;
    const payProBitcoinCashUrl: string = `bitcoincash:?r=https://${
      this.testStr
    }bitpay.com/i/${this.invoiceId}`;
    const payProUrl =
      this.coin === 'btc' ? payProBitcoinUrl : payProBitcoinCashUrl;

    this.httpNative.post(url, dataSrc, headers).subscribe(
      () => {
        this.logger.info('Set Buyer Provided Email SUCCESS');
        this.incomingDataProvider.redir(payProUrl);
      },
      data => {
        const error = this.parseError(data);
        this.logger.warn(
          'Cannot Set Buyer Provided Email ERROR ' + data.status + '. ' + error
        );
      }
    );
  }
}
