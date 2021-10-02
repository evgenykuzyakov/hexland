import React from 'react';
import "error-polyfill";
import 'bootstrap/dist/js/bootstrap.bundle';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./App.scss";
import './gh-fork-ribbon.css';
import * as nearAPI from 'near-api-js'
import ls from "local-storage";
import GlPage from "./pages/GL";
import Big from "big.js";

const IsMainnet = false; // window.location.hostname === "berry.cards";
const TestNearConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  archivalNodeUrl: 'https://rpc.mainnet.internal.near.org', // https://rpc.testnet.internal.near.org',
  contractName: 'dev-1633114897352-65032726804099',
  walletUrl: 'https://wallet.testnet.near.org',
};
const MainNearConfig = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  archivalNodeUrl: 'https://rpc.mainnet.internal.near.org',
  contractName: 'dev-1633114897352-65032726804099',
  walletUrl: 'https://wallet.near.org',
};

export const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;

export class App extends React.Component {
  constructor(props) {
    super(props);

    this._near = {};

    this.state = {
      connected: false,
      draw: false,
      isNavCollapsed: true,
      account: null,
      accountBalance: Big(0),
      color: `#${Math.trunc(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`
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
    // this._near.archivalConnection = nearAPI.Connection.fromConfig({
    //   networkId: NearConfig.networkId,
    //   provider: { type: 'JsonRpcProvider', args: { url: NearConfig.archivalNodeUrl } },
    //   signer: { type: 'InMemorySigner', keyStore }
    // });
    this._near.keyStore = keyStore;
    this._near.near = near;

    this._near.walletConnection = new nearAPI.WalletConnection(near, NearConfig.contractName);
    this._near.accountId = this._near.walletConnection.getAccountId();

    this._near.account = this._near.walletConnection.account();


    // this._near.berryclub = new nearAPI.Account(this._near.archivalConnection, 'berryclub.ek.near');
    //
    this._near.contract = new nearAPI.Contract(this._near.account, NearConfig.contractName, {
      viewMethods: ['get_cells_json', 'get_storage_balance'],
      changeMethods: ['draw_json'],
    });

    if (this._near.accountId) {
      const balance = Big(await this._near.contract.get_storage_balance({
        account_id: this._near.accountId
      }) || "0");
      this.setState({
        accountBalance: balance,
      })
    }

  }

  async requestSignIn(e) {
    e && e.preventDefault();
    const appTitle = '';
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
      setState: (s, c) => this.setState(s, c),
      refreshAllowance: () => this.refreshAllowance(),
      state: this.state
    };
    const header = !this.state.connected ? (
      <div>Connecting... <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span></div>
    ) : (this.state.signedIn ? (
      <div>
        <button className="btn btn-primary me-2" onClick={() => this.setState({ draw: !this.state.draw})}>{!this.state.draw ? "Scroll mode" : "Draw mode"}</button>
        {this.state.draw && <>
          Color:
          <div className="d-inline-block align-middle">
            <input className="form-control ms-2 p-0" type="color" id="color" name="color" style={{minWidth: "5em"}}
                   value={this.state.color} onChange={(e) => this.setState({
              color: e.target.value
            })} />
          </div>
        </>}

        <div style={{float: "right"}}>
          <label>
            Account Balance: {this.state.accountBalance.div(Big(10).pow(24)).toFixed(3)} NEAR
          </label>
          <button
            className="btn btn-outline-secondary ms-2"
            onClick={() => this.logOut()}>Sign out ({this.state.signedAccountId})</button>
        </div>
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
        {header}
        <a className="github-fork-ribbon right-bottom fixed" href="https://github.com/evgenykuzyakov/hexland" data-ribbon="Fork me on GitHub"
           title="Fork me on GitHub">Fork me on GitHub</a>

        <GlPage {...passProps}/>
      </div>
    )
  }
}
