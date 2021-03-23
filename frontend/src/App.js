import React from 'react';
import "error-polyfill";
import 'bootstrap/dist/js/bootstrap.bundle';
// import 'bootstrap/dist/css/bootstrap.min.css';
import "./App.scss";
import './gh-fork-ribbon.css';
import * as nearAPI from 'near-api-js'
import HomePage from "./pages/Home";
import {HashRouter as Router, Link, Route, Switch} from 'react-router-dom'
import ls from "local-storage";

const IsMainnet = window.location.hostname === "berry.cards";
const TestNearConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  archivalNodeUrl: 'https://rpc.testnet.internal.near.org',
  contractName: 'dev-1614796345972-8721304',
  walletUrl: 'https://wallet.testnet.near.org',
};
const MainNearConfig = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  archivalNodeUrl: 'https://rpc.mainnet.internal.near.org',
  contractName: 'cards.berryclub.ek.near',
  walletUrl: 'https://wallet.near.org',
};

const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;

class App extends React.Component {
  constructor(props) {
    super(props);

    this._near = {};

    this._near.lsKey = NearConfig.contractName + ':v01:';
    this._near.lsKeyRecentCards = this._near.lsKey + "recentCards";

    this.state = {
      connected: false,
      isNavCollapsed: true,
      account: null,
      requests: null,
      recentCards: ls.get(this._near.lsKeyRecentCards) || [],
    };

    this._initNear().then(() => {
      this.setState({
        signedIn: !!this._near.accountId,
        signedAccountId: this._near.accountId,
        connected: true,
      });
    });
  }


  async _initNear() {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(Object.assign({deps: {keyStore}}, NearConfig));
    this._near.keyStore = keyStore;
    this._near.near = near;

    this._near.walletConnection = new nearAPI.WalletConnection(near, NearConfig.contractName);
    this._near.accountId = this._near.walletConnection.getAccountId();

    this._near.account = this._near.walletConnection.account();
    this._near.contract = new nearAPI.Contract(this._near.account, NearConfig.contractName, {
      viewMethods: ['get_account', 'get_num_accounts', 'get_accounts', 'get_num_cards', 'get_top', 'get_rating', 'get_trade_data', 'get_card_info', 'get_account_cards'],
      changeMethods: ['register_account', 'vote', 'buy_card'],
    });

  }

  async requestSignIn(e) {
    e && e.preventDefault();
    const appTitle = 'Berry Cards';
    await this._near.walletConnection.requestSignIn(
      NearConfig.contractName,
      appTitle
    )
    return false;
  }

  async logOut() {
    this._near.walletConnection.signOut();
    this._near.accountId = null;
    this.setState({
      signedIn: !!this._accountId,
      signedAccountId: this._accountId,
    })
  }

  popRequest(c) {
    const requests = this.state.requests.slice(1);
    this.setState({
      requests,
    }, c);
  }

  addRequest(r, c) {
    const requests = this.state.requests.slice(0);
    requests.push(r);
    this.setState({
      requests,
    }, c);
  }

  addRecentCard(cardId) {
    let recentCards = this.state.recentCards.slice(0);
    const index = recentCards.indexOf(cardId);
    if (index !== -1) {
      recentCards.splice(index, 1);
    }
    recentCards.unshift(cardId);
    recentCards = recentCards.slice(0, 5);
    ls.set(this._near.lsKeyRecentCards, recentCards);
    this.setState({
      recentCards
    })
  }

  async refreshAllowance() {
    alert("You're out of access key allowance. Need sign in again to refresh it");
    await this.logOut();
    await this.requestSignIn();
  }

  render() {
    const passProps = {
      _near: this._near,
      updateState: (s, c) => this.setState(s, c),
      popRequest: (c) => this.popRequest(c),
      addRequest: (r, c) => this.addRequest(r, c),
      addRecentCard: (cardId) => this.addRecentCard(cardId),
      refreshAllowance: () => this.refreshAllowance(),
      ...this.state
    };
    const header = !this.state.connected ? (
      <div>Connecting... <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span></div>
    ) : (this.state.signedIn ? (
      <div>
        <button
          className="btn btn-outline-secondary"
          onClick={() => this.logOut()}>Sign out ({this.state.signedAccountId})</button>
      </div>
    ) : (
      <div>
        <button
          className="btn btn-primary"
          onClick={(e) => this.requestSignIn(e)}>Sign in with NEAR Wallet</button>
      </div>
    ));

    return (
      <div className="App">
        <a className="github-fork-ribbon right-bottom fixed" href="https://github.com/evgenykuzyakov/berry-hot" data-ribbon="Fork me on GitHub"
           title="Fork me on GitHub">Fork me on GitHub</a>

        <HomePage {...passProps}/>
      </div>
    )
  }
}

export default App;
