import { Account, Contract, uint256, Provider } from 'starknet'
import starkErc20Abi from './bin/starknet_erc20_abi.json'
import { dequantize } from './utils'

export const getStarknetUserBalance = async (
  tokenAddress: string,
  starkNetRpc: string,
  userAddress: string,
  decimal: number,
) => {
  const provider = new Provider({ rpc: { nodeUrl: starkNetRpc } })
  const erc20 = new Contract(starkErc20Abi, tokenAddress, provider)

  const res = await erc20.balanceOf(userAddress)
  const balanceInWei = uint256.uint256ToBN(res.balance).toString()

  const balance = dequantize(balanceInWei, decimal)

  return balance
}

export const executeStarknetTransaction = async (
  rpcUrl: string,
  userPublicAddress: string,
  privateKey: string,
  data: any,
) => {
  const provider = new Provider({ rpc: { nodeUrl: rpcUrl } })
  const account = new Account(provider, userPublicAddress, privateKey)
  const res = await account.execute(JSON.parse(data))
  return res
}
