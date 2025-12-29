<h1 align="center">tanX Connector NodeJS</h1>


> **Trading and deposits are currently available only to institutional accounts.**
>
> tanX is transitioning to an institution-first model to support compliant, large-scale market participation.
> To become an institutional account, please contact [support@tanx.fi](mailto:support@tanx.fi)


<p align="center">
  The official NodeJS connector for <a href="https://docs.tanx.fi/tech/api-documentation">tanX's API</a> 🚀
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tanx-libs/tanx-connector)](https://www.npmjs.org/package/@tanx-libs/tanx-connector)
[![Build status](https://img.shields.io/github/actions/workflow/status/tanx-libs/tanx-connector-nodejs/main.yml)](https://github.com/tanx-libs/tanx-connector-nodejs/actions/workflows/main.yml)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@tanx-libs/tanx-connector)](https://bundlephobia.com/package/@tanx-libs/tanx-connector@latest)

</div>

## Features

- Complete endpoints including REST and WebSockets
- Methods return parsed JSON.
- High level abstraction for ease of use.
- Easy authentication
- Automatically sets JWT token internally
- Calls refresh endpoint when token expires.
- Typescript Types✨

tanX Connector includes utility/connector functions which can be used to interact with the tanX API. It uses axios internally to handle all requests. It includes interceptors for setting JWT and handling re-login on token expiry.

## Installation

First, go to [tanX's Website](https://www.tanx.fi/) and create an account with your wallet.

Install from npm

```sh
npm i @tanx-libs/tanx-connector
```

## Getting Started

The default base url for mainnet is https://api.tanx.fi. All REST apis, WebSockets are handled by Client, WsClient classes respectively. All operations must be handled in a try-catch block.

### Workflow

Check out the [example files](./example) to see an example workflow.

To use library inside example files

```sh
npm run start
npm run start:ws
```

### Rest Client

Import the REST Client

```ts
import { Client } from '@tanx-libs/tanx-connector'
```

Create a new instance.

```ts
const client = new Client()
// or
const client = new Client('testnet') // default mainnet
```

### General Endpoints

#### Test connectivity

`GET /sapi/v1/health/`

```ts
client.testConnection()
```

#### 24hr Price

`GET /sapi/v1/market/tickers/`

```ts
client.get24hPrice({ market: 'ethusdc' })
```

#### Kline/Candlestick Data

`GET /sapi/v1/market/kline/`

```ts
client.getCandlestick({
  market: 'ethusdc',
  period: 120,
})
```

#### Order Book

`GET /sapi/v1/market/orderbook/`

```ts
client.getOrderBook({
  market: 'ethusdc',
})
```

#### Recent trades

`GET /sapi/v1/market/trades/`

```ts
client.getRecentTrades({
  market: 'ethusdc',
})
```

#### Login

Both `login` and `completeLogin` sets JWT as Authorization Token. Optionally, `setAccessToken` and `setRefreshToken` can be used to set tokens directly.

getNonce: `POST /sapi/v1/auth/nonce/`  
login: `POST /sapi/v1/auth/login/`

```ts
import { signMsg } from '@tanx-libs/tanx-connector'

const nonce = await client.getNonce(ethAddress)
const signedMsg = signMsg(nonce.payload, ethPrivateKey)
const loginRes = await client.login(ethAddress, signedMsg.signature)

// or

const loginRes = await client.completeLogin(ethAddress, ethPrivateKey) //calls above functions internally

// or

client.setAccessToken(access) // same as client.setToken()
client.setRefreshToken(refresh)
// these functions are called internally when you use login or completeLogin
```

#### Refresh Token

`POST /sapi/v1/auth/token/refresh/`

If refresh token is set (manually or by using login functions), the refresh endpoint is called automatically when access token expires. Optionally, you can call `refreshTokens` manually by passing in refreshToken (passing it is optional, it'll work if has been set before).

```ts
const res = await client.refreshTokens(refreshToken)
```

#### Logout

Sets tokens to null

```ts
client.logOut()
```

#### Profile Information (Private 🔒)

`GET /sapi/v1/user/profile/`

```ts
client.getProfileInfo()
```

#### Balance details (Private 🔒)

`GET /sapi/v1/user/balance/`

```ts
client.getBalance()
```

#### Profit and Loss Details (Private 🔒)

`GET /sapi/v1/user/pnl/`

```ts
client.getProfitAndLoss()
```

#### Create order (Private 🔒)

Create Nonce Body

```ts
const nonceBody: CreateOrderNonceBody = {
  market: 'ethusdc',
  ord_type: 'market',
  price: 29580.51,
  side: 'buy',
  volume: 0.0001,
}
```

> If you are affiliated with the tanX organization, please ensure that you add the organization_key and api_key to the request body in both the nonce and create endpoints. This field is entirely optional. To obtain these keys, please reach out to tanX at support@tanx.fi.
>
> ```ts
> const nonceBody: CreateOrderNonceBody = {
>   market: 'ethusdc',
>   ord_type: 'market',
>   price: 29580.51,
>   side: 'buy',
>   volume: 0.0001,
>   organization_key: 'YOUR_ORGANIZATION_KEY', // This is an optional field. The organization’s key shared by tanX organization.
>   api_key: 'YOUR_API_KEY', // This is an optional field. The organization’s API key shared by tanX organization.
> }
> ```

Create Order

createOrderNonce: `POST /sapi/v1/orders/nonce/`
createNewOrder: `POST /sapi/v1/orders/create/`

```ts
const order = await client.createCompleteOrder(nonceBody, ethPrivateKey)
//calls below functions internally, we recommend using createCompleteOrder for ease of use

// or
import { signMsgHash } from '@tanx-libs/tanx-connector'

const orderNonce = await client.createOrderNonce(nonceBody)
const signedBody = signMsgHash(orderNonce.payload, ethPrivateKey)
const order = await client.createNewOrder({
  ...signedBody,
  organization_key: '', // This is an optional field. The organization’s key shared by tanX organization.
  api_key: '',
}) // This is an optional field. The organization’s API key shared by tanX organization.

// or
import {
  createUserSignature,
  getKeyPairFromSignature,
  signOrderWithStarkKeys,
} from '@tanx-libs/tanx-connector'

const orderNonce = await client.createOrderNonce(nonceBody)
const userSignature = createUserSignature(ethPrivateKey, 'testnet') // or sign it yourself; default mainnet
const keyPair = getKeyPairFromSignature(userSignature.signature)
const signedBody = signOrderWithStarkKeys(keyPair, orderNonce.payload)
const order = await client.createNewOrder(signedBody)
```

#### Bulk Cancel (Private 🔒)

bulkCancel: `POST /sapi/v1/user/bulkcancel/`

```ts
const order = await client.bulkCancel({
  market: 'btcusdt', // specify the market to cancel
  limit: '100', // This is an optional field; the default limit is 100.
  side: 'buy', // This is an optional field, which the orders need to be cancelled
})
```

#### Get Order (Private 🔒)

`GET /sapi/v1/orders/{order_id}/`

```ts
client.getOrder(orderId)
```

#### List orders (Private 🔒)

`GET /sapi/v1/orders/`

```ts
client.listOrders()
```

#### Cancel Order (Private 🔒)

`POST /sapi/v1/orders/cancel/`

```ts
client.cancelOrder(order_id)
```

#### List Trades (Private 🔒)

`GET /sapi/v1/trades/`

```ts
client.listTrades()
```

### WebSocket Client

Import the WebSocket Client

```ts
import { WsClient } from '@tanx-libs/tanx-connector'
```

Create a new instance

```ts
const wsClient = new WsClient('public')
// or
const wsClient = new WsClient('public', 'testnet') // default is 'mainnet'
// or
const loginRes = await client.completeLogin(ethAddress, ethPrivateKey)
const wsClient = new WsClient('private', 'testnet', loginRes.token.access)
// pass in jwt as 3rd argument for private connections
```

#### Connect

```ts
wsClient.connect()
```

#### Subscribe

```ts
const streams = ['btcusdc.trades', 'btcusdc.ob-inc', 'btcusdc.kline-5m']
wsClient.subscribe(streams)

// or fpr private

wsClient.subscribe(['trade', 'order'])
```

#### Unsubscribe

```ts
const streams = ['btcusdc.trades', 'btcusdc.ob-inc', 'btcusdc.kline-5m']
wsClient.unsubscribe(streams)

// or fpr private

wsClient.unsubscribe(['trade', 'order'])
```

#### Disconnect

```ts
wsClient.disconnect()
```

#### Usage

WsClient includes a member called ws which is initialized with the [NodeJS WebSocket library](https://github.com/websockets/ws) (ws). You may use it to handle WebSocket operations.

```ts
wsClient.ws.on('message', (data) => {
  console.log(data.toString())
})
```

### Error Handling

Errors thrown are of types `AuthenticationError | AxiosError`.

Example

```ts
import { isAuthenticationError } from '@tanx-libs/tanx-connector'
try {
  // async operations
} catch (e) {
  if (isAuthenticationError(e)) {
    console.log(e)
  } else {
    console.log(e as AxiosError<Response<string>>)
  }
}
```

#### Create L2 Key Pair

You can create your own stark key pairs using the utility functions below

```ts
import { generateKeyPairFromEthPrivateKey } from '@tanx-libs/tanx-connector'

const keypair = generateKeyPairFromEthPrivateKey(ethPrivateKey, 'testnet') // default is mainnet

const stark_public_key = keypair.getPublic().getX().toString('hex')
const stark_private_key = keypair.getPrivate().toString('hex')
```

### Internal Transfer

Users will be able to seamlessly transfer assets from their CEXs or other chains with minimal fees.

To get started with the feature, follow these two steps:

1. Reach out to tanX (support@tanx.fi) to get the organization key and API key.

2. Generate the L2 key pair with your private key using the following example:

```ts
import { generateKeyPairFromEthPrivateKey } from '@tanx-libs/tanx-connector'

const keypair = generateKeyPairFromEthPrivateKey(ethPrivateKey, 'testnet')
```

### Available methods:

#### To process the internal transfer, call the `initiateAndProcessInternalTransfers` method and pass the necessary arguments:

```ts
const internalTransferResponse =
  await client.initiateAndProcessInternalTransfers(
    keypair, // The keypair generated in the above step.
    organizationKey, // The organization’s key shared by tanX organization.
    apiKey, // The organization’s API key shared by tanX organization.
    'usdc', // The currency (e.g., USDC). Currently, we support USDC.
    amount, // The amount (e.g., 10).
    destination_address, // The receiver's eth address.
    client_reference_id, // This is an optional field. If not specified, then it’s generated randomly. You can use this to uniquely identify a transfer at your end.
  )
```

#### Retrieve a list of transfers initiated by the authenticated user:

```javascript
const internalTransferList = await client.listInternalTransfers({
  limit: 10, // This field is optional.
  offset: 10, // This field is optional.
})
```

#### Retrieve an internal transfer using its client reference id:

```javascript
const internalTransferList = await client.getInternalTransferByClientId(
  client_reference_id, // The client reference id you want to retrieve
)
```

#### Check if a user exists by their destination address.

```javascript
const checkUserRes = await client.checkInternalTransferUserExists(
  tanXOrganizationKey,
  tanXApiKey,
  destination_address, // The destination address you want to check.
)
```

### Setting Allowance

Granting permission for token spending enables transactions on Ethereum and other chains.

> Supported EVM cross-chain networks: 'ETHEREUM', 'POLYGON', 'OPTIMISM', 'ARBITRUM', 'LINEA', 'SCROLL', 'MODE'.

```js
// Note: Please use ethers version 5.5.3.
import { Wallet, ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_PROVIDER, // Replace your RPC URL based on your destination network.
)

const signer = new Wallet(privateKey, provider)

const res = await client.setAllowance(
  'usdc', // Enter the coin symbol.
  signer,
  'SCROLL', // Enter the network for which you want to grant allowance.
  // This argument is optional; if you pass the argument, the gasLimit and gasPrice will be overridden while executing the transaction.
  // {
  //   gasLimit: '',
  //   gasPrice: '',
  // },
)
```

### Deposit

#### Ethereum Deposit

There are two ways to make a deposit on the Ethereum network:

<!-- 1. Using ETH Private Key and RPC URL: This approach utilizes your ETH private key and an rpcUrl (e.g., from Infura or Alchemy).
2. Custom Provider and Signer: This method involves creating your provider and signer using ethers.js or web3.js. You'll also need the stark_public_key. -->

#### 1. Using ETH Private Key and RPC URL:

In this method, you will use an ETH private key and an RPC URL to execute a deposit. You'll also need to create an RPC URL using services like Infura, Alchemy, etc. Here's the code snippet for this method:

```javascript
  const res = await client.depositFromEthereumNetwork(
    process.env.RPC_PROVIDER as string, // Replace your RPC URL based on your destination network.
    privateKey, // Your ETH private key.
    'testnet', // Network allowed values are 'testnet' or 'mainnet'.
    'eth', // Enter the coin symbol.
    0.00001, // Enter the amount you want to deposit.
  );
```

#### 2. Using Custom Provider and Signer:

This method involves using a custom provider and signer, which can be created using the ethers.js library. The `stark_public_key` mentioned in the code should be obtained using the steps described in the [Create L2 Key Pair](#create-l2-key-pair) section. Here's the code snippet for this method:

```javascript
// Note: Please use ethers version 5.5.3.
import { Wallet, ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_PROVIDER, // Replace your RPC URL based on your destination network.
)

const signer = new Wallet(privateKey, provider)

const depositRes = await client.depositFromEthereumNetworkWithStarkKey(
  signer, // The signer created above.
  provider, // The provider created above.
  `0x${stark_public_key}`, // The stark_public_key created above.
  0.0000001, // Enter the amount you want to deposit.
  'eth', // Enter the coin symbol.
)
```

#### Cross-Chain Deposit

There are two protocols to make a deposit on the Cross-chain: one is EVM (Ethereum-supported chain) and the other is Starknet deposit.

#### 1. EVM Cross-Chain Deposit

There are two ways to make a deposit on the EVM Cross-chain:

> Supported EVM cross-chain networks - 'POLYGON' | 'OPTIMISM' | 'ARBITRUM' | 'LINEA' | 'SCROLL' | 'MODE'

#### 1. Using ETH Private Key and RPC URL:

In this method, you will use an ETH private key and an RPC URL to execute a Cross-Chain deposit. You'll also need to create an RPC URL using services like Infura, Alchemy, etc. Here's the code snippet for this method:

```javascript
  const depositRes = await client.crossChainDeposit(
    process.env.RPC_PROVIDER as string, // Replace your RPC URL based on your destination network.
    privateKey, // Your ETH private key.
    'usdt', // Enter the coin symbol.
    1, // Enter the amount you want to deposit.
    'SCROLL' // Enter the network you want to deposit into.
    // This argument is optional; if you pass the argument, the gasLimit and gasPrice will be overridden while executing the transaction.
    {
      gasLimit: '',
      gasPrice: '',
    },
  );
```

#### 2. Using Custom Provider and Signer:

This method involves using a custom provider and signer, which can be created using the ethers.js library. Here's the code snippet for this method:

```javascript
// Note: Please use ethers version 5.5.3.
import { Wallet, ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_PROVIDER, // Replace your RPC URL based on your destination network.
)

const signer = new Wallet(privateKey, provider)

const depositRes = await client.crossChainDepositWithSigner(
  signer, // The signer created above.
  provider, // The provider created above.
  'usdc', // Enter the coin symbol.
  0.00001, // Enter the amount you want to deposit.
  'SCROLL' // Enter the network you want to deposit into.
  // This argument is optional; if you pass the argument, the gasLimit and gasPrice will be overridden while executing the transaction.
  {
    gasLimit: '',
    gasPrice: '',
  },
)
```

#### 2. Starknet Cross-Chain Deposit

There are two ways to make a deposit on the Starknet Cross-chain:

> Currently, Starknet deposits are only supported on the tanX mainnet.

#### 1. Using Starknet Private Key and RPC URL:

In this method, you will use a Starknet private key and an RPC URL to execute a Cross-Chain deposit. You'll also need to create an RPC URL using services like Infura, Alchemy, etc. Here's the code snippet for this method:

```javascript
  const depositRes = await client.starknetDeposit(
    '14', // Enter the amount you want to deposit.
    'usdc', // Enter the coin symbol.
    process.env.STARKNET_RPC_PROVIDER as string, // Replace your RPC URL based on your destination network.
    starknetPublicKey as string,  // Your starknet public address.
    starknetPrivateKey as string,  // Your starknet private key.
  );
```

#### 2. Using Custom Provider and Signer:

This method involves using a custom provider and signer, which can be created using the starknet.js library. Here's the code snippet for this method:

```javascript
// Note: Please use starknet.js version 5.14.1.
import { Account, RpcProvider } from 'starknet'


// Replace your RPC URL based on your destination network.
const provider = new RpcProvider({ nodeUrl: rpcURL  })
const account = new Account(
  provider,
  userStarknetPublicAddress,
  userStarknetPrivateKey,
)

const depositRes = await client.starknetDepositWithStarknetSigner(
  '14', // Enter the amount you want to deposit.
  'usdc', // Enter the coin symbol.
   starknetPublicKey as string,  // Your starknet public address.
   account, // The account created above.
   provider, // The provider created above.
);
```

#### List Deposits

To get the deposit history, you can use the following code:

```javascript
const depositsList = await client.listDeposits({
  network: 'ETHEREUM', // Specify the network for which you want to list the deposit history. Allowed networks include 'ETHEREUM', 'POLYGON', 'OPTIMISM', 'ARBITRUM', 'LINEA', 'SCROLL', 'STARKNET' and 'MODE'.
  page: 2, // This is an optional field
  limit: 1, // This is an optional field
})
```

### Withdrawal

Generally, we have two modes of withdrawal: Normal Withdrawal and Fast Withdrawal. For withdrawal methods that require a signer and provider, please refer to the deposit method mentioned above.

#### Normal Withdrawal

With Normal Withdrawal, your requested funds will be processed within a standard time frame (24 hours). This mode is suitable for users who are not in a rush to access their funds and are comfortable with the regular processing time.

```javascript
// Withdrawals

// Normal withdrawal:
// 1. Initiate your withdrawal request by calling the "initiateNormalWithdrawal" function.
const withdrawalRes = await client.initiateNormalWithdrawal(
  keyPair, // The keyPair created above
  0.0001, // Enter the amount you want to withdraw
  'usdc', // Enter the coin symbol
)
// 2. WAIT for up to 24 hours.
// 3. Check whether the withdrawn balance is pending by calling the "getPendingNormalWithdrawalAmountByCoin" function with the required parameters.
const pendingBalance = await client.getPendingNormalWithdrawalAmountByCoin(
  'eth', // Enter the coin symbol
  ethAddress, // User public eth address
  signer, // The signer created above
)
// 4. In the final step, if you find the balance is more than 0, you can use the "completeNormalWithdrawal" function to withdraw the cumulative amount to your ETH wallet.
const completeNWRes = await client.completeNormalWithdrawal(
  'eth', // Enter the coin symbol
  ethAddress, // User public eth address
  signer, // The signer created above
)

//Get a list of withdrawals
const withdrawalsList = await client.listNormalWithdrawals({
  page: 2, // This is an optional field
})
```

#### Fast Withdrawal

With Fast Withdrawal, your funds will be processed in an expedited timeframe, often within a few minutes. This mode is ideal for users who require immediate access to their funds and are comfortable with paying a fee.

```javascript
const fastWithdrawalRes = await client.fastWithdrawal(
  keyPair, // The keyPair created above
  11, // Enter the amount you want to withdraw
  'usdc', // Enter the coin symbol
  'ETHEREUM', // Allowed networks include 'ETHEREUM', 'POLYGON', 'OPTIMISM', 'ARBITRUM', 'LINEA', 'SCROLL', and 'MODE'
)

//Get a list of fast withdrawals
const fastwithdrawalsList = await client.listFastWithdrawals({
  page: 2, // This is an optional field
  network: 'ETHEREUM', // Allowed networks include 'ETHEREUM', 'POLYGON', 'OPTIMISM', 'ARBITRUM', 'LINEA', 'SCROLL', 'STARKNET' and 'MODE'
})
```

#### Cross-chain withdrawal

> Supported EVM cross-chain networks - 'POLYGON' | 'OPTIMISM' | 'ARBITRUM' | 'LINEA' | 'SCROLL' | 'MODE' | 'STARKNET'

On the cross-chain withdrawal network, we only support fast withdrawals.

```javascript
const fastWithdrawalRes = await client.fastWithdrawal(
  keyPair, // The keyPair created above
  11, // Enter the amount you want to withdraw
  'usdc', // Enter the coin symbol
  'STARKNET', // Enter the network you want to withdraw from.
  starknetPublicKey, // Your StarkNet public address is required if you are doing a StarkNet fast withdrawal.
)
```
