const { gql } = require('apollo-server-express')


const typeDefs = gql`



type Query {
    parrot: Root
} 

type Root {
    debtType: [DebtType]
    vaultType: [VaultType]
    vault: [Vault]
    mockOracle: [MockOracle]
    config: Config
} 

type DebtType {
    publicKey: String
    account: DebtTypeAccount
} 

type VaultType {
    publicKey: String
    account: VaultTypeAccount
} 

type Vault {
    publicKey: String
    account: VaultAccount
} 

type MockOracle {
    publicKey: String
    account: MockOracleAccount
} 

type DebtTypeAccount {
    version: String
    debtToken: String
    debtOriginator: String
    interestsHolder: String
    owner: String
    nonce: String
} 

type VaultTypeAccount {
    version: String
    debtType: String
    collateralToken: String
    collateralTokenHolder: String
    priceOracle: String
    nonce: String
    minimumCollateralRatio: String
    liquidationCollateralRatio: String
    liquidationPenalty: String
    interestRate: String
    interestAccum: String
    interestAccumUpdated: String
    accruedInterests: String
    debtCeiling: String
    totalDebt: String
} 

type VaultAccount {
    version: String
    vaultType: String
    owner: String
    debtAmount: String
    collateralAmount: String
    interestAccum: String
} 

type MockOracleAccount {
    price: String
    priceDecimal: String
} 

type DebtTypeUpdate {
    owner: String
    interestsHolder: String
} 

type VaultTypeUpdate {
    minimumCollateralRatio: String
    liquidationCollateralRatio: String
    liquidationPenalty: String
    interestRate: String
    debtCeiling: String
    priceOracle: String
} 

enum EventType {
    updateDebtType
    initVaultType
    updateVaultType
    initVault
    stake
    borrow
    repay
    unstake
    liquidate
    vaultDebtAccum 
}

type UpdateDebtType {
    debt_type: String
} 

type InitVaultType {
    vault_type: String
} 

type UpdateVaultType {
    vault_type: String
} 

type InitVault {
    vault: String
} 

type Stake {
    vault: String
    amount: String
} 

type Borrow {
    vault: String
    amount: String
} 

type Repay {
    vault: String
    amount: String
} 

type Unstake {
    vault: String
    amount: String
} 

type Liquidate {
    vault: String
    amount: String
} 

type VaultDebtAccum {
    vault: String
    amount: String
} 

type TokenPrice {
    tokenDecimal: String
    bidTokenDecimal: String
    price: String
    priceDecimal: String
} 


type Config {
    provider: String
    programId: String
    anchorVersion: String
}
`

module.exports ={typeDefs}