import {
  Account,
  Contract,
  uint256,
  RpcProvider,
  AccountInterface,
} from 'starknet'
import starkErc20Abi from './bin/starknet_erc20_abi.json'
import { dequantize } from './utils'

export const getStarknetUserBalance = async (
  provider: RpcProvider,
  tokenAddress: string,
  userAddress: string,
  decimal: number,
) => {
  const erc20 = new Contract(starkErc20Abi, tokenAddress, provider)
  const res = await erc20.balanceOf(userAddress)
  const balanceInWei = uint256.uint256ToBN(res.balance).toString()
  const balance = dequantize(balanceInWei, decimal)
  return balance
}

export const executeStarknetTransaction = async (
  provider: RpcProvider,
  userPublicAddress: string,
  account: AccountInterface,
  data: any,
) => {
  const res = await account.execute(JSON.parse(data))
  return res
}
