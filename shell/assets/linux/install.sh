#!/bin/bash
cd /tmp
# download pre-built pacakge to tmp
wget https://github.com/bitpay/copay/releases/download/v0.1.1/DGBWallet-linux-x64.tar.gz
# extract archive
tar -xvf /tmp/DGBWallet-linux-x64.tar.gz
# move the package to opt
mv /tmp/DGBWallet /opt/DGBWallet
# symlink `copay` to user path
ln -s /opt/DGBWallet/DGBWallet /usr/local/bin/copay
cd /usr/share/applications
# download desktop entry
wget https://raw.githubusercontent.com/bitpay/copay/master/shell/assets/linux/Copay.desktop
