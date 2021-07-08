## Privacy

This is a [non-custodial][ncw] service.

That means *you* and **only you** are responsible for the
private key to your wallet. No data about the wallets used on this page are stored on
the server.

All stellar operations happen within the browser.

Data is only sent to stellar's horizon server to submit the transactions to the ledger.

### Your secrets do not leave the browser
In order to [claim](/claim) a claimable balance a transaction signed by your account
must be submitted to stellar's network.

In order to not handle the secrets in plain text you can sign the transaction with 
[Freighter][freighter] to keep complete control over your secrets.


### Cookies
This site does **not** set any cookies. All settings are stored in the [local storage][ls] of
your browser. 

[freighter]: https://www.freighter.app/
[ls]: https://developer.mozilla.org/de/docs/Web/API/Window/localStorage "Local storage documentation"
[ncw]: https://medium.com/mogulproductions/blockchain-explained-custodial-vs-non-custodial-wallets-76e6128834b0 "Explanation of non-custodial wallets"
