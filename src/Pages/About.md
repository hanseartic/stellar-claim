## What's this about?
Here you can explore claimable balances on [stellar] network and claim them
into the given account.

### Why
On stellar you need to explicitly trust an asset before you can hold it in your account.

By default, you can hold [*Stellar Lumens* (i.e. **XLM**)][lumens] in your wallet.
But there are so [many other][power-of-stellar] assets [out there][explore-assets].

Before a payment with any other assets can be made to your account
you'd need to set up a [trustline][trustlines] to that asset.
That means no-one could send an asset to your account, that you don't trust yet.

However [claimable balance][claimable-balance]s for any (even not yet trusted assets) can be
created on the ledger by a sender. You can list all claimable balances and decide
which ones to claim.

In case you choose to claim a listed balance for which no trustline was established
yet, this service will take care of it and create the trustline on-the-fly while claiming.

### How does it work?
* Enter your stellar account (e.g. *<abbr data-length=12><keygen /></abbr>*) into the search bar
* The list will show all balances that can be claimed into the given account
* Select balances to claim
* Click button to claim the selected balances into your wallet
  * Sign the transaction with [Freighter][freighter]
* On success the balances will now be in your wallet

### Is this service free of charge?
Yes! You don't need to pay anything to use this service.

However, feel free to send a donation to <b><object data-env="REACT_APP_DONATION_ADDRESS"></object></b>.

<embed type="img/donation-qr" />


[claimable-balance]: https://developers.stellar.org/docs/glossary/claimable-balance/
[explore-assets]: https://stellar.expert/explorer/public/asset
[freighter]: https://www.freighter.app/
[lumens]: https://stellar.org/lumens/
[power-of-stellar]: https://stellar.org/learn/the-power-of-stellar/
[stellar]: https://stellar.org/
[trustlines]: https://medium.com/stellar-community/a-guide-to-trustlines-on-stellar-8bc46091a86f
