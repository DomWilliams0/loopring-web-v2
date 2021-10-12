export type WithdrawData = {
    belong: string | undefined,
    tradeValue: number | undefined,
    balance: number | undefined,
    address: string | undefined,
}

export type TransferData = {
    belong: string | undefined,
    tradeValue: number | undefined,
    balance: number | undefined,
    address: string | undefined,
    memo: string | undefined,
}

export type DepositData = {
    belong: string | undefined,
    tradeValue: number | undefined,
    balance: number | undefined,
    reffer: string | undefined,
}

export type ModalDataStatus = {
    withdrawValue: WithdrawData,
    transferValue: TransferData,
    depositValue: DepositData,
}