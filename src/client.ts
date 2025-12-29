import axios, { AxiosInstance as AxiosInstanceType } from 'axios'
import {
  Balance,
  CancelOrder,
  CandleStickParams,
  CandleStickPayload,
  CoinStat,
  CheckUserExistsBody,
  CheckUserExistsPayload,
  CreateNewOrderBody,
  CreateOrderNonceBody,
  CreateOrderNoncePayload,
  FullDayPricePayload,
  InitiateWithdrawalPayload,
  InitiateNormalWithdrawalResponse,
  InternalTransfer,
  InternalTransferInitiateBody,
  InternalTransferInitiatePayload,
  InternalTransferProcessBody,
  ListInternalTransferParams,
  ListInternalTransferPayload,
  ListOrdersParams,
  LoginResponse,
  Market,
  Order,
  OrderBookParams,
  OrderBookPayload,
  OrderPayload,
  ProfileInformationPayload,
  ProfitAndLossPayload,
  RecentTradesParams,
  RecentTradesPayload,
  Response,
  TradeParams,
  TradePayload,
  ValidateNormalWithdrawalPayload,
  ValidateNormalWithdrawalResponse,
  ProcessFastWithdrawalPayload,
  InitiateFastWithdrawalResponse,
  ProcessFastWithdrawalResponse,
  ListDepositParams,
  Pagination,
  ListWithdrawalParams,
  Deposit,
  NormalWithdrawal,
  FastWithdrawal,
  Network,
  NetworkStat,
  NetworkCoinStat,
  CrossChainAvailableNetwork,
  LayerSwapDepositFeeParams,
  LayerSwapDepositFeePayload,
  InitiateLayerSwapDepositPayload,
  LayerSwapAvailableNetwork,
  bulkCancelParams,
} from './types'
import { AxiosInstance } from './axiosInstance'
import { signMsg } from './bin/blockchain_utils'
import { getKeyPairFromSignature, sign } from './bin/signature'
import {
  createUserSignature,
  filterCrossChainCoin,
  signInternalTxMsgHash,
  signWithdrawalTxMsgHash,
  toFixed,
} from './utils'
import { ec } from 'elliptic'
import {
  approveUnlimitedAllowanceUtil,
  dequantize,
  filterEthereumCoin,
  get0X0to0X,
  getAllowance,
  getNonce,
  signMsgHash,
  formatWithdrawalAmount,
  removeHexPrefix,
} from './utils'
import { Wallet, ethers } from 'ethers'
import { CONFIG } from './constants'
import {
  AllowanceTooLowError,
  BalanceTooLowError,
  CoinNotFoundError,
  InstitutionalOnlyError,
  InvalidAmountError,
} from './error'
import { executeStarknetTransaction, getStarknetUserBalance } from './starknet'
import { Account, AccountInterface, RpcProvider } from 'starknet'

export class Client {
  axiosInstance: AxiosInstanceType
  getAuthStatus: () => void
  setToken: (token: string | null) => void
  setAccessToken: (token: string | null) => void
  setRefreshToken: (token: string | null) => void
  private refreshToken?: string | null
  private accessToken?: string | null
  option: 'mainnet' | 'testnet'

  constructor(option: 'mainnet' | 'testnet' = 'mainnet') {
    const baseURL =
      option === 'testnet'
        ? 'https://api-testnet.tanx.fi'
        : 'https://api.tanx.fi'
    const axios = new AxiosInstance(this.refreshTokens, baseURL)
    this.axiosInstance = axios.axiosInstance
    this.setAccessToken = (token: string | null) => {
      this.accessToken = token
      axios.setAccessToken(token)
    }
    this.setRefreshToken = (token: string | null) => {
      this.refreshToken = token
      axios.setRefreshToken(token)
    }
    this.setToken = axios.setAccessToken
    this.getAuthStatus = axios.getAuthStatus
    this.option = option
  }

  async testConnection(): Promise<Response<string>> {
    const res = await this.axiosInstance.get<Response<string>>(
      '/sapi/v1/health/',
    )
    return res.data
  }

  async get24hPrice(params?: {
    market?: Market
  }): Promise<Response<FullDayPricePayload>> {
    const res = await this.axiosInstance.get<Response<FullDayPricePayload>>(
      `/sapi/v1/market/tickers/`,
      { params: params },
    )
    return res.data
  }

  async getCandlestick(
    params: CandleStickParams,
  ): Promise<Response<CandleStickPayload>> {
    const res = await this.axiosInstance.get<Response<CandleStickPayload>>(
      `/sapi/v1/market/kline/`,
      { params: params },
    )
    return res.data
  }

  async getOrderBook(
    params: OrderBookParams,
  ): Promise<Response<OrderBookPayload>> {
    const res = await this.axiosInstance.get<Response<OrderBookPayload>>(
      `/sapi/v1/market/orderbook/`,
      { params: params },
    )
    return res.data
  }

  async getRecentTrades(
    params: RecentTradesParams,
  ): Promise<Response<RecentTradesPayload[]>> {
    const res = await this.axiosInstance.get<Response<RecentTradesPayload[]>>(
      `/sapi/v1/market/trades/`,
      { params: params },
    )
    return res.data
  }

  async getNonce(ethAddress: string): Promise<Response<string>> {
    const nonceRes = await this.axiosInstance.post<Response<string>>(
      '/sapi/v2/auth/nonce/',
      {
        eth_address: ethAddress,
      },
    )
    return nonceRes.data
  }

  async login(
    ethAddress: string,
    userSignature: string,
  ): Promise<LoginResponse> {
    const loginRes = await this.axiosInstance.post<LoginResponse>(
      '/sapi/v2/auth/login/',
      {
        eth_address: ethAddress,
        user_signature: userSignature,
      },
    )
    this.setAccessToken(loginRes.data.token.access)
    this.setRefreshToken(loginRes.data.token.refresh)

    loginRes.data.payload.signature = userSignature

    return loginRes.data
  }

  async completeLogin(
    ethAddress: string,
    privateKey: string,
  ): Promise<LoginResponse> {
    const nonce = await this.getNonce(ethAddress)
    const signedMsg = signMsg(nonce.payload, privateKey)
    const loginRes = await this.login(ethAddress, signedMsg.signature)

    return loginRes
  }

  async getVaultId(coin: string) {
    this.getAuthStatus()
    const res = await this.axiosInstance.post(`main/user/create_vault/`, {
      coin: coin,
    })
    return res.data
  }

  async getCoinStatus(): Promise<Response<CoinStat>> {
    const res = await this.axiosInstance.post(`/main/stat/v2/coins/`)
    return res.data
  }

  async getNetworkConfig(): Promise<NetworkStat> {
    const res = await this.axiosInstance.post(`/main/stat/v2/app-and-markets/`)
    return res.data.payload.network_config
  }

  async approveUnlimitedAllowanceEthereumNetwork(coin: string, signer: Wallet) {
    const { payload: coinStats } = await this.getCoinStatus()
    const currentCoin = filterEthereumCoin(coinStats, coin)
    const { token_contract: tokenContract } = currentCoin
    const starkContract = CONFIG.STARK_CONTRACT[this.option]

    const res = await approveUnlimitedAllowanceUtil(
      starkContract,
      tokenContract,
      signer,
    )

    return res
  }

  async approveUnlimitedAllowancePolygonNetwork(coin: string, signer: Wallet) {
    const network_config = await this.getNetworkConfig()
    const polygonConfig = network_config['POLYGON']
    const allowedTokens = polygonConfig.tokens
    const contractAddress = polygonConfig.deposit_contract

    const currentCoin = filterCrossChainCoin(polygonConfig, coin, 'DEPOSIT')
    const { token_contract: tokenContract } = currentCoin

    const res = await approveUnlimitedAllowanceUtil(
      contractAddress,
      tokenContract,
      signer,
    )

    return res
  }

  async getTokenBalance(
    provider: ethers.providers.Provider,
    ethAddress: string,
    currency: string,
  ): Promise<number> {
    if (currency === 'eth') {
      const res = await provider.getBalance(ethAddress)
      return +ethers.utils.formatEther(res)
    }

    const { payload: coinStats } = await this.getCoinStatus()
    const currentCoin = filterEthereumCoin(coinStats, currency)
    const { token_contract: tokenContract, decimal } = currentCoin
    const contract = new ethers.Contract(
      tokenContract,
      CONFIG.ERC20_ABI,
      provider,
    )
    const balance = (await contract.balanceOf(ethAddress)).toString()
    const normalBalance = balance / Math.pow(10, +decimal)
    return normalBalance
  }

  async getPolygonTokenBalance(
    provider: ethers.providers.Provider,
    ethAddress: string,
    currency: string,
  ) {
    if (currency === 'pol') {
      const res = await provider.getBalance(ethAddress)
      return +ethers.utils.formatEther(res)
    }
    const network_config = await this.getNetworkConfig()
    const polygonConfig = network_config['POLYGON']
    const allowedTokens = polygonConfig.tokens

    const currentCoin = filterCrossChainCoin(polygonConfig, currency, 'TOKENS')

    const { blockchain_decimal: decimal, token_contract: tokenContract } =
      currentCoin
    const contract = new ethers.Contract(
      tokenContract,
      CONFIG.ERC20_ABI,
      provider,
    )
    const balance = (await contract.balanceOf(ethAddress)).toString()
    const normalBalance = balance / Math.pow(10, +decimal)
    return normalBalance
  }

  async getEVMTokenBalance(
    provider: ethers.providers.Provider,
    ethAddress: string,
    currency: string,
    network: CrossChainAvailableNetwork,
  ) {
    if (this.getNativeCurrencyByNetwork(network) === currency) {
      const res = await provider.getBalance(ethAddress)
      return +ethers.utils.formatEther(res)
    }
    const network_config = await this.getNetworkConfig()
    const currenctNetworkConfig = network_config[network.toUpperCase()]
    // const allowedTokens = currenctNetworkConfig.tokens

    const currentCoin = filterCrossChainCoin(
      currenctNetworkConfig,
      currency,
      'TOKENS',
    )

    const { blockchain_decimal: decimal, token_contract: tokenContract } =
      currentCoin
    const contract = new ethers.Contract(
      tokenContract,
      CONFIG.ERC20_ABI,
      provider,
    )
    const balance = (await contract.balanceOf(ethAddress)).toString()
    const normalBalance = balance / Math.pow(10, +decimal)

    return normalBalance
  }

  async depositFromEthereumNetworkWithStarkKey(
    signer: Wallet,
    provider: ethers.providers.Provider,
    starkPublicKey: string,
    amount: string | number,
    currency: string,
  ) {
    throw new InstitutionalOnlyError();

    if (!(Number(amount) > 0)) {
      throw new InvalidAmountError(
        `Please enter a valid amount. It should be a numerical value greater than zero.`,
      )
    }
    
    this.getAuthStatus()
    const { payload: coinStats } = await this.getCoinStatus()
    const currentCoin = filterEthereumCoin(coinStats, currency)

    const {
      quanitization,
      decimal,
      token_contract: tokenContract,
      stark_asset_id: starkAssetId,
    } = currentCoin

    const quantizedAmount = ethers.utils.parseUnits(
      amount?.toString(),
      Number(quanitization),
    )

    const vault = await this.getVaultId(currency)
    const starkContract = CONFIG.STARK_CONTRACT[this.option]
    const starkABI = CONFIG.STARK_ABI[this.option]

    const contract = new ethers.Contract(starkContract, starkABI, signer)
    const parsedAmount = ethers.utils.parseEther(String(amount))
    const gwei = ethers.utils.formatUnits(parsedAmount, 'gwei')

    const overrides = {
      value: parsedAmount,
      nonce: await getNonce(signer, provider),
    }

    const balance = await this.getTokenBalance(
      provider,
      signer.address,
      currency,
    )

    if (balance < +amount) {
      throw new BalanceTooLowError(
        `Current Balance (${balance}) for '${currency}' is too low, please add balance before deposit`,
      )
    }

    let depositResponse
    if (currency === 'eth') {
      depositResponse = await contract.depositEth(
        starkPublicKey,
        starkAssetId,
        vault.payload.id,
        overrides,
      )
    } else {
      const allowance = await getAllowance(
        signer.address,
        starkContract,
        tokenContract,
        +decimal,
        provider,
      )
      if (Number(allowance) < +amount) {
        throw new AllowanceTooLowError(
          `Current Allowance (${allowance}) is too low, please use client.setAllowance()`,
        )
      }

      depositResponse = await contract.depositERC20(
        starkPublicKey,
        starkAssetId,
        vault.payload.id,
        quantizedAmount,
      )
    }

    const res = await this.cryptoDepositStart(
      currency === 'eth' ? +gwei * 10 : quantizedAmount.toString(),
      get0X0to0X(starkAssetId),
      get0X0to0X(starkPublicKey),
      depositResponse['hash'],
      depositResponse['nonce'],
      vault.payload.id,
    )
    // Instead of getting the payload as "", we can send the solidity transaction_hash (response) that we received from the "depositEth | depositERC20". This way, it's easy to check the transaction.
    res.payload = { transaction_hash: depositResponse.hash }

    return res
  }

  async depositFromEthereumNetwork(
    rpcURL: string,
    ethPrivateKey: string,
    network: Network,
    currency: string,
    amount: string | number,
  ) {
    throw new InstitutionalOnlyError();
    this.getAuthStatus()
    const userSignature = createUserSignature(ethPrivateKey, network) // or sign it yourself
    const keyPair = getKeyPairFromSignature(userSignature.signature)
    const stark_public_key = keyPair.getPublic().getX().toString('hex')
    const provider = new ethers.providers.JsonRpcProvider(rpcURL)
    const signer = new Wallet(ethPrivateKey, provider)
    return this.depositFromEthereumNetworkWithStarkKey(
      signer,
      provider,
      `0x${stark_public_key}`,
      String(amount),
      currency,
    )
  }

  getNativeCurrencyByNetwork(network: CrossChainAvailableNetwork): string {
    const networkConfig = {
      POLYGON: 'pol',
      OPTIMISM: 'eth',
      ARBITRUM: 'eth',
      LINEA: 'eth',
      SCROLL: 'eth',
      MODE: 'eth',
    }

    return networkConfig[network]
  }

  async crossChainDepositWithSigner(
    signer: Wallet,
    provider: ethers.providers.Provider,
    currency: string,
    amount: string,
    network: CrossChainAvailableNetwork,
    gasOptions?: ethers.Overrides,
  ) {
    throw new InstitutionalOnlyError();
    if (!(Number(amount) > 0)) {
      throw new InvalidAmountError(
        `Please enter a valid amount. It should be a numerical value greater than zero.`,
      )
    }
    this.getAuthStatus()
    const network_config = await this.getNetworkConfig()
    const selectedNetworkConfig = network_config[network.toUpperCase()]
    // const allowedTokens = selectedNetworkConfig.tokens
    const contractAddress = selectedNetworkConfig.deposit_contract

    const currentCoin = filterCrossChainCoin(
      selectedNetworkConfig,
      currency.toLowerCase(),
      'DEPOSIT',
      network.toUpperCase(),
    )

    const { blockchain_decimal: decimal, token_contract: tokenContract } =
      currentCoin

    const quantizedAmount = ethers.utils.parseUnits(amount?.toString(), decimal)

    const contract = new ethers.Contract(
      contractAddress,
      CONFIG.POLYGON_ABI.abi,
      signer,
    )

    const parsedAmount = ethers.utils.parseEther(String(amount))

    // const gwei = ethers.utils.formatUnits(parsedAmount, 'gwei')

    const params = {
      value: parsedAmount,
      from: signer.address,
      ...gasOptions,
    }

    const balance = await this.getEVMTokenBalance(
      provider,
      signer.address,
      currency.toLowerCase(),
      network,
    )

    if (balance < +amount) {
      throw new BalanceTooLowError(
        `Current Balance (${balance}) for '${currency}' is too low, please add balance before deposit`,
      )
    }

    let depositResponse

    if (currency.toLowerCase() === this.getNativeCurrencyByNetwork(network)) {
      depositResponse = await contract.depositNative(params)
    } else {
      const allowance = await getAllowance(
        signer.address,
        contractAddress,
        tokenContract,
        +decimal,
        provider,
      )

      if (Number(allowance) < +amount) {
        throw new AllowanceTooLowError(
          `Current Allowance (${allowance}) is too low, please use client.setAllowance()`,
        )
      }

      depositResponse = await contract.deposit(tokenContract, quantizedAmount, {
        from: signer.address,
        ...gasOptions,
      })
    }

    const res = await this.crossChainDepositStart(
      amount,
      currency.toLowerCase(),
      depositResponse['hash'],
      depositResponse['nonce'],
      network,
    )

    // Instead of getting the payload as "", we can send the solidity transaction_hash (response) that we received from the "depositEth | depositERC20". This way, it's easy to check the transaction.
    res.payload = { transaction_hash: depositResponse.hash }

    return res
  }

  async crossChainDeposit(
    rpcURL: string,
    ethPrivateKey: string,
    currency: string,
    amount: string,
    network: CrossChainAvailableNetwork,
    gasOptions?: ethers.Overrides,
  ) {
    throw new InstitutionalOnlyError();
    this.getAuthStatus()
    const provider = new ethers.providers.JsonRpcProvider(rpcURL)
    const signer = new Wallet(ethPrivateKey, provider)
    return this.crossChainDepositWithSigner(
      signer,
      provider,
      currency.toLowerCase(),
      amount,
      network,
      gasOptions,
    )
  }

  async setAllowance(
    coin: string,
    signer: Wallet,
    network: CrossChainAvailableNetwork | 'ETHEREUM',
    gasOptions?: ethers.Overrides,
  ) {
    if (network === 'ETHEREUM') {
      return await this.approveUnlimitedAllowanceEthereumNetwork(
        coin.toLowerCase(),
        signer,
      )
    }
    const network_config = await this.getNetworkConfig()
    const currenctNetworkConfig = network_config[network.toUpperCase()]
    // const allowedTokens = currenctNetworkConfig.tokens
    const contractAddress = currenctNetworkConfig.deposit_contract

    const currentCoin = filterCrossChainCoin(
      currenctNetworkConfig,
      coin.toLowerCase(),
      'DEPOSIT',
      network.toUpperCase(),
    )

    const { token_contract: tokenContract } = currentCoin

    const res = await approveUnlimitedAllowanceUtil(
      contractAddress,
      tokenContract,
      signer,
      gasOptions,
    )

    return res
  }

  async depositFromPolygonNetworkWithSigner(
    signer: Wallet,
    provider: ethers.providers.Provider,
    currency: string,
    amount: string | number,
    gasOptions?: ethers.Overrides,
  ) {
    throw new InstitutionalOnlyError();
    if (!(Number(amount) > 0)) {
      throw new InvalidAmountError(
        `Please enter a valid amount. It should be a numerical value greater than zero.`,
      )
    }
    this.getAuthStatus()
    const network_config = await this.getNetworkConfig()
    const polygonConfig = network_config['POLYGON']
    const allowedTokens = polygonConfig.tokens
    const contractAddress = polygonConfig.deposit_contract

    const currentCoin = filterCrossChainCoin(
      polygonConfig,
      currency,
      'DEPOSIT',
      'POLYGON',
    )

    const { blockchain_decimal: decimal, token_contract: tokenContract } =
      currentCoin

    const quantizedAmount = ethers.utils.parseUnits(
      amount?.toString(),
      Number(decimal),
    )

    const polygonContract = new ethers.Contract(
      contractAddress,
      CONFIG.POLYGON_ABI.abi,
      signer,
    )

    const parsedAmount = ethers.utils.parseEther(String(amount))
    const gwei = ethers.utils.formatUnits(parsedAmount, 'gwei')

    const params = {
      value: parsedAmount,
      from: signer.address,
      ...gasOptions,
    }

    const balance = await this.getPolygonTokenBalance(
      provider,
      signer.address,
      currency,
    )

    if (balance < +amount) {
      throw new BalanceTooLowError(
        `Current Balance (${balance}) for '${currency}' is too low, please add balance before deposit`,
      )
    }

    let depositResponse

    if (currency === 'pol') {
      depositResponse = await polygonContract.depositNative(params)
    } else {
      const allowance = await getAllowance(
        signer.address,
        contractAddress,
        tokenContract,
        +decimal,
        provider,
      )
      if (Number(allowance) < +amount) {
        throw new AllowanceTooLowError(
          `Current Allowance (${allowance}) is too low, please use client.setAllowance()`,
        )
      }
      depositResponse = await polygonContract.deposit(
        tokenContract,
        quantizedAmount,
        { from: signer.address },
      )
    }

    const res = await this.crossChainDepositStart(
      amount,
      currency,
      depositResponse['hash'],
      depositResponse['nonce'],
    )

    // Instead of getting the payload as "", we can send the solidity transaction_hash (response) that we received from the "depositEth | depositERC20". This way, it's easy to check the transaction.
    res.payload = { transaction_hash: depositResponse.hash }

    return res
  }

  async depositFromPolygonNetwork(
    rpcURL: string,
    ethPrivateKey: string,
    // network: Network,
    currency: string,
    amount: string | number,
    gasOptions?: ethers.Overrides,
  ) {
    throw new InstitutionalOnlyError();
    this.getAuthStatus()
    const provider = new ethers.providers.JsonRpcProvider(rpcURL)
    const signer = new Wallet(ethPrivateKey, provider)
    return this.depositFromPolygonNetworkWithSigner(
      signer,
      provider,
      currency,
      String(amount),
      gasOptions,
    )
  }

  async getPendingNormalWithdrawalAmountByCoin(
    coinSymbol: string,
    userPublicEthAddress: string,
    signer: Wallet,
  ) {
    this.getAuthStatus()
    const { payload: coinStats } = await this.getCoinStatus()
    const currentCoin = filterEthereumCoin(coinStats, coinSymbol)
    const {
      stark_asset_id: starkAssetId,
      blockchain_decimal: blockchainDecimal,
    } = currentCoin
    const starkContract = CONFIG.STARK_CONTRACT[this.option]
    const starkABI = CONFIG.STARK_ABI[this.option]

    const contract = new ethers.Contract(starkContract, starkABI, signer)

    const balance = await contract.getWithdrawalBalance(
      ethers.BigNumber.from(userPublicEthAddress),
      ethers.BigNumber.from(starkAssetId),
    )

    return formatWithdrawalAmount(
      balance,
      Number(blockchainDecimal),
      coinSymbol,
    )
  }

  // Normal withdrawal 'initiate' and 'validate'
  async startNormalWithdrawal(body: InitiateWithdrawalPayload) {
    const res = await this.axiosInstance.post<
      Response<InitiateNormalWithdrawalResponse>
    >(`/sapi/v1/payment/withdrawals/v1/initiate/`, {
      amount: body.amount,
      token_id: body.symbol,
    })
    return res.data
  }

  async validateNormalWithdrawal(body: ValidateNormalWithdrawalPayload) {
    const res = await this.axiosInstance.post<
      Response<ValidateNormalWithdrawalResponse>
    >(`/sapi/v1/payment/withdrawals/v1/validate/`, body)
    return res.data
  }

  // Fast withdrawal  'initiate' and 'process'
  async startFastWithdrawal(body: InitiateWithdrawalPayload) {
    const res = await this.axiosInstance.post<
      Response<InitiateFastWithdrawalResponse>
    >(`/sapi/v1/payment/fast-withdrawals/v2/initiate/`, {
      amount: body.amount,
      token_id: body.symbol,
      network: body.network,
      cc_address: body.cc_address,
    })
    return res.data
  }

  async processFastWithdrawal(body: ProcessFastWithdrawalPayload) {
    const res = await this.axiosInstance.post<
      Response<ProcessFastWithdrawalResponse>
    >(`/sapi/v1/payment/fast-withdrawals/v2/process/`, body)
    return res.data
  }

  // Fast Withdrawal public function
  async fastWithdrawal(
    keyPair: ec.KeyPair,
    amount: number | string,
    coinSymbol: string,
    network:
      | CrossChainAvailableNetwork
      | LayerSwapAvailableNetwork
      | 'ETHEREUM',
    cc_address?: string,
  ): Promise<Response<ProcessFastWithdrawalResponse>> {
    if (!(Number(amount) > 0)) {
      throw new InvalidAmountError(
        `Please enter a valid amount. It should be a numerical value greater than zero.`,
      )
    }
    this.getAuthStatus()
    if (network !== 'ETHEREUM') {
      const network_config = await this.getNetworkConfig()
      const coinConfig = network_config[network.toUpperCase()]
      const _ = filterCrossChainCoin(
        coinConfig,
        coinSymbol.toLowerCase(),
        'WITHDRAWAL',
        network.toUpperCase(),
      )
    } else {
      const { payload: coinStats } = await this.getCoinStatus()
      const _ = filterEthereumCoin(coinStats, coinSymbol.toLowerCase())
    }

    const initiateResponse = await this.startFastWithdrawal({
      amount: Number(amount),
      symbol: coinSymbol.toLowerCase(),
      network: network,
      cc_address: cc_address,
    })

    const signature = signWithdrawalTxMsgHash(
      keyPair,
      initiateResponse.payload.msg_hash,
    )

    const validateResponse = await this.processFastWithdrawal({
      msg_hash: initiateResponse.payload.msg_hash,
      signature: signature,
      fastwithdrawal_withdrawal_id:
        initiateResponse.payload.fastwithdrawal_withdrawal_id,
    })
    return validateResponse
  }

  // Normal Withdrawal public function
  // first step
  async initiateNormalWithdrawal(
    keyPair: ec.KeyPair,
    amount: number | string,
    coinSymbol: string,
  ): Promise<Response<ValidateNormalWithdrawalResponse>> {
    if (!(Number(amount) > 0)) {
      throw new InvalidAmountError(
        `Please enter a valid amount. It should be a numerical value greater than zero.`,
      )
    }
    this.getAuthStatus()
    const { payload: coinStats } = await this.getCoinStatus()
    const _ = filterEthereumCoin(coinStats, coinSymbol)
    const initiateResponse = await this.startNormalWithdrawal({
      amount: Number(amount),
      symbol: coinSymbol,
    })
    const signature = signWithdrawalTxMsgHash(
      keyPair,
      initiateResponse.payload.msg_hash,
    )
    const msgHex = ethers.BigNumber.from(
      initiateResponse.payload.msg_hash,
    ).toHexString()
    const validateResponse = await this.validateNormalWithdrawal({
      msg_hash: removeHexPrefix(msgHex, true),
      signature: signature,
      nonce: initiateResponse.payload.nonce,
    })
    return validateResponse
  }

  // last step
  async completeNormalWithdrawal(
    coinSymbol: string,
    userPublicEthAddress: string,
    signer: Wallet,
  ): Promise<ethers.providers.TransactionResponse> {
    this.getAuthStatus()
    const { payload: coinStats } = await this.getCoinStatus()
    const currentCoin = filterEthereumCoin(coinStats, coinSymbol)
    const { stark_asset_id: starkAssetId } = currentCoin
    const starkContract = CONFIG.STARK_CONTRACT[this.option]
    const starkABI = CONFIG.STARK_ABI[this.option]
    const contract = new ethers.Contract(starkContract, starkABI, signer)

    const res = await contract.withdraw(userPublicEthAddress, starkAssetId)
    return res
  }

  async listDeposits(
    params?: ListDepositParams,
  ): Promise<Response<Pagination<Deposit>>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<Pagination<Deposit>>>(
      `/sapi/v1/deposits/all`,
      { params: params },
    )
    return res.data
  }

  async saveLayerSwapTx(ref_id: string, transaction_hash: string) {
    const res = await this.axiosInstance.post(
      `/sapi/v1/payment/layer-swap/deposit/save/`,
      {
        ref_id,
        transaction_hash,
      },
    )

    return res.data
  }

  formatLayerSwapInitateData(
    data: Response<InitiateLayerSwapDepositPayload>,
    tokenAddress: string,
  ): {
    to: string
    amount: string
    ref_id: string
    data: any
    tokenAddress: string
  } {
    return {
      to: data?.payload?.ls_data?.to_address,
      amount: data?.payload?.ls_data?.base_units,
      ref_id: data?.payload?.ref_id,
      data: data?.payload?.ls_data?.data,
      tokenAddress: tokenAddress,
    }
  }

  async initiateLayerSwapDeposit(
    amount: string | number,
    token_id: string,
    cc_address: string,
    fee_meta: LayerSwapDepositFeePayload,
  ): Promise<Response<InitiateLayerSwapDepositPayload>> {
    this.getAuthStatus()
    const source_network = 'STARKNET'
    const res = await this.axiosInstance.post(
      `/sapi/v1/payment/layer-swap/deposit/`,
      {
        amount,
        token_id,
        cc_address,
        fee_meta,
        source_network,
      },
    )

    return res.data
  }

  async fetchLayerSwapDepositInfo(
    params?: LayerSwapDepositFeeParams,
  ): Promise<Response<LayerSwapDepositFeePayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<
      Response<LayerSwapDepositFeePayload>
    >(`/sapi/v1/payment/layer-swap/deposit/fee/`, { params: params })

    return res.data
  }

  async starknetDepositWithStarknetSigner(
    amount: string | number,
    token_id: string,
    userStarknetPublicAddress: string,
    account: AccountInterface,
    provider: RpcProvider,
  ) {
    throw new InstitutionalOnlyError();
    const source_network = 'STARKNET'
    // Fetch the network configuration
    const network_config = await this.getNetworkConfig()

    // Select the network configuration for StarkNet
    const selectedNetworkConfig = network_config[source_network]

    // Filter and get the current coin details for deposit
    const currentCoin = filterCrossChainCoin(
      selectedNetworkConfig,
      token_id?.toLowerCase() as string,
      'DEPOSIT',
      source_network,
    )

    const { blockchain_decimal: decimal, token_contract: tokenContract } =
      currentCoin

    // Get the user's balance on StarkNet
    const balance = await getStarknetUserBalance(
      provider,
      tokenContract,
      userStarknetPublicAddress,
      Number(decimal),
    )

    // Fetch the fee details for LayerSwap deposit
    const layerSwapFeeDetail = await this.fetchLayerSwapDepositInfo({
      token_id,
      source_network,
    })

    // Extract the max and min allowed amounts for the deposit
    const maxAmount = Number(layerSwapFeeDetail.payload?.max_amount)
    const minAmount = Number(layerSwapFeeDetail.payload?.min_amount)

    // Check if the user's balance is sufficient for the deposit after accounting for fees
    if (
      Number(balance) - Number(layerSwapFeeDetail.payload.fee_amount) <
        Number(amount) ||
      Number(balance) === 0
    ) {
      throw Error('Your blockchain wallet has insufficient balance')
    }

    // Ensure the deposit amount does not exceed the maximum allowed amount
    if (maxAmount < Number(amount)) {
      throw Error(
        `Amount cannot exceed ${maxAmount} ${token_id?.toUpperCase()}`,
      )
    }

    // Ensure the deposit amount is not less than the minimum required amount
    if (Number(amount) < minAmount) {
      throw Error(
        `Amount should be at least ${minAmount} ${token_id?.toUpperCase()}`,
      )
    }

    // Initiate the LayerSwap deposit
    const initiateRes = await this.initiateLayerSwapDeposit(
      amount,
      token_id,
      userStarknetPublicAddress,
      layerSwapFeeDetail.payload,
    )

    // Format the data required for initiating the deposit
    const formattedData = this.formatLayerSwapInitateData(
      initiateRes,
      tokenContract,
    )

    // Execute the StarkNet transaction
    const executeResponse = await executeStarknetTransaction(
      provider,
      userStarknetPublicAddress,
      account,
      formattedData.data,
    )

    // Save the transaction details
    const saveRes = await this.saveLayerSwapTx(
      formattedData.ref_id,
      executeResponse.transaction_hash,
    )

    // Add the transaction hash to the response payload
    saveRes.payload = { transaction_hash: executeResponse.transaction_hash }

    // Return the final response
    return saveRes
  }

  async starknetDeposit(
    amount: string | number,
    token_id: string,
    rpcURL: string,
    userStarknetPublicAddress: string,
    userStarknetPrivateKey: string,
  ) {
    throw new InstitutionalOnlyError();
    const provider = new RpcProvider({ nodeUrl: rpcURL })
    const account = new Account(
      provider,
      userStarknetPublicAddress,
      userStarknetPrivateKey,
    )
    return this.starknetDepositWithStarknetSigner(
      amount,
      token_id,
      userStarknetPublicAddress,
      account,
      provider,
    )
  }

  async listNormalWithdrawals(
    params?: ListWithdrawalParams,
  ): Promise<Response<Pagination<NormalWithdrawal>>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<
      Response<Pagination<NormalWithdrawal>>
    >(`/sapi/v1/payment/withdrawals/`, { params: params })
    return res.data
  }

  async listFastWithdrawals(
    params?: ListWithdrawalParams,
  ): Promise<Response<Pagination<FastWithdrawal>>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<
      Response<Pagination<FastWithdrawal>>
    >(`/sapi/v1/payment/fast-withdrawals/`, { params: params })
    return res.data
  }

  async cryptoDepositStart(
    amount: number | bigint | string,
    starkAssetId: string,
    starkPublicKey: string,
    depositBlockchainHash: string,
    depositBlockchainNonce: string,
    vaultId: number,
  ) {
    const amountTostring = amount.toString()
    const res = await this.axiosInstance.post(`/sapi/v1/payment/stark/start/`, {
      amount: amountTostring,
      token_id: starkAssetId,
      stark_key: starkPublicKey,
      deposit_blockchain_hash: depositBlockchainHash,
      deposit_blockchain_nonce: depositBlockchainNonce,
      vault_id: vaultId,
    })
    return res.data
  }

  async crossChainDepositStart(
    amount: number | bigint | string,
    currency: string,
    depositBlockchainHash: string,
    depositBlockchainNonce: string,
    network?: CrossChainAvailableNetwork,
  ) {
    const amountTostring = amount.toString()
    const res = await this.axiosInstance.post(
      `/sapi/v1/deposits/crosschain/create/`,
      {
        amount: amountTostring,
        currency: currency.toLowerCase(),
        network: network ? network : 'POLYGON',
        deposit_blockchain_hash: depositBlockchainHash,
        deposit_blockchain_nonce: depositBlockchainNonce,
      },
    )
    return res.data
  }

  async getProfileInfo(): Promise<Response<ProfileInformationPayload>> {
    this.getAuthStatus()
    const profileRes = await this.axiosInstance.get<
      Response<ProfileInformationPayload>
    >('/sapi/v1/user/profile/')
    return profileRes.data
  }

  async getBalance(params?: {
    currency?: string
  }): Promise<Response<Balance | Balance[]>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<Balance | Balance[]>>(
      '/sapi/v1/user/balance/',
      { params: params },
    )
    return res.data
  }

  async getProfitAndLoss(): Promise<Response<ProfitAndLossPayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<ProfitAndLossPayload>>(
      '/sapi/v1/user/pnl/',
    )
    return res.data
  }

  async createOrderNonce(
    body: CreateOrderNonceBody,
  ): Promise<Response<CreateOrderNoncePayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.post<
      Response<CreateOrderNoncePayload>
    >('/sapi/v1/orders/nonce/', body)
    return res.data
  }

  async createCompleteOrder(
    nonce: CreateOrderNonceBody,
    privateKey: string,
  ): Promise<Response<Order>> {
    throw new InstitutionalOnlyError();
    this.getAuthStatus()
    const nonceRes = await this.createOrderNonce(nonce)
    const signedMsg = signMsgHash(nonceRes.payload, privateKey, this.option)

    const order = await this.createNewOrder(signedMsg)
    return order
  }

  async createNewOrder(body: CreateNewOrderBody): Promise<Response<Order>> {
    throw new InstitutionalOnlyError();

    this.getAuthStatus()
    const res = await this.axiosInstance.post<Response<Order>>(
      '/sapi/v1/orders/create/',
      body,
    )
    return res.data
  }

  async bulkCancel(body: bulkCancelParams): Promise<Response<any>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.post<Response<any>>(
      '/sapi/v1/user/bulkcancel/',
      body,
    )
    return res.data
  }

  async getOrder(orderId: number): Promise<Response<OrderPayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<OrderPayload>>(
      `/sapi/v1/orders/${orderId}`,
    )
    return res.data
  }

  async listOrders(params?: ListOrdersParams): Promise<Response<Order[]>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<Order[]>>(
      `/sapi/v1/orders`,
      { params: params },
    )
    return res.data
  }

  async cancelOrder(orderId: number): Promise<Response<CancelOrder>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.post<
      Response<Omit<OrderPayload, 'id'> & { order_id: number }>
    >(`/sapi/v1/orders/cancel/`, { order_id: orderId })
    return res.data
  }

  async listTrades(params?: TradeParams): Promise<Response<TradePayload[]>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<TradePayload[]>>(
      `/sapi/v1/trades/`,
      { params: params },
    )
    return res.data
  }

  async initiateInternalTransfer(
    body: InternalTransferInitiateBody,
  ): Promise<Response<InternalTransferInitiatePayload>> {
    const res = await this.axiosInstance.post<
      Response<InternalTransferInitiatePayload>
    >('/sapi/v1/internal_transfers/v2/initiate/', body)
    return res.data
  }

  async executeInternalTransfers(
    body: InternalTransferProcessBody,
  ): Promise<Response<InternalTransfer>> {
    const res = await this.axiosInstance.post<Response<InternalTransfer>>(
      '/sapi/v1/internal_transfers/v2/process/',
      body,
    )
    return res.data
  }

  async initiateAndProcessInternalTransfers(
    keyPair: ec.KeyPair,
    organization_key: string,
    api_key: string,
    currency: string,
    amount: number,
    destination_address: string,
    client_reference_id?: string,
  ): Promise<Response<InternalTransfer>> {
    this.getAuthStatus()
    const initiateResponse = await this.initiateInternalTransfer({
      organization_key,
      api_key,
      currency,
      amount,
      destination_address,
      client_reference_id,
    })
    const signature = signInternalTxMsgHash(
      keyPair,
      initiateResponse.payload.msg_hash,
    )
    const executeResponse = await this.executeInternalTransfers({
      organization_key,
      api_key,
      signature,
      nonce: initiateResponse.payload.nonce,
      msg_hash: initiateResponse.payload.msg_hash,
    })
    return executeResponse
  }

  async listInternalTransfers(
    params?: ListInternalTransferParams,
  ): Promise<Response<ListInternalTransferPayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<
      Response<ListInternalTransferPayload>
    >(`/sapi/v1/internal_transfers/v2/`, { params: params })
    return res.data
  }

  async getInternalTransferByClientId(
    client_reference_id: string,
  ): Promise<Response<InternalTransfer>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.get<Response<InternalTransfer>>(
      `/sapi/v1/internal_transfers/v2/${client_reference_id}`,
    )
    return res.data
  }

  async checkInternalTransferUserExists(
    organization_key: string,
    api_key: string,
    destination_address: string,
  ): Promise<Response<CheckUserExistsPayload>> {
    this.getAuthStatus()
    const res = await this.axiosInstance.post<Response<CheckUserExistsPayload>>(
      `/sapi/v1/internal_transfers/v2/check_user_exists/`,
      { destination_address, organization_key, api_key },
    )
    return res.data
  }

  refreshTokens = async (
    refreshToken?: string,
  ): Promise<Response<LoginResponse['token']> | undefined> => {
    if (refreshToken || this.refreshToken) {
      const res = await this.axiosInstance.post(
        '/sapi/v1/auth/token/refresh/',
        {
          refresh: refreshToken ?? this.refreshToken,
        },
      )

      this.setAccessToken(res.data.payload.access)
      this.setRefreshToken(res.data.payload.refresh)

      return res.data
    }
  }

  logOut = () => {
    this.setAccessToken(null)
    this.setRefreshToken(null)
  }
}
