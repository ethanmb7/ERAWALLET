import { Component } from '@angular/core';
import { HomePage } from '../home/home';
import { ReceivePage } from '../receive/receive';
import { ScanPage } from '../scan/scan';
import { SendPage } from '../send/send';
import { SettingsPage } from '../settings/settings';

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {

  public homeRoot = HomePage;
  public receiveRoot = ReceivePage;
  public scanRoot = ScanPage;
  public sendRoot = SendPage;
  public settingsRoot = SettingsPage;

  constructor() {

  }
}
