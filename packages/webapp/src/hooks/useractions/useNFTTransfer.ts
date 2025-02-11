import React, { useCallback } from 'react';

import * as sdk from '@loopring-web/loopring-sdk'

import { connectProvides } from '@loopring-web/web3-provider';

import {
    AccountStep,
    setShowNFTTransfer,
    SwitchData,
    TransferProps,
    useOpenModals,
} from '@loopring-web/component-lib';
import {
    AccountStatus,
    CoinMap,
    FeeInfo,
    IBData,
    NFTWholeINFO,
    SagaStatus,
    WalletMap
} from '@loopring-web/common-resources';

import { useTokenMap } from 'stores/token';
import { useAccount } from 'stores/account';
// import { useChargeFees } from '../common/useChargeFees';
import { LoopringAPI } from 'api_wrapper';
import { useSystem } from 'stores/system';
import { myLog } from "@loopring-web/common-resources";
import { makeWalletLayer2 } from 'hooks/help';
import { useWalletLayer2Socket, walletLayer2Service } from '../../services/socket';
import { getTimestampDaysLater } from 'utils/dt_tools';
import { AddressError, BIGO, DAYS, TOAST_TIME } from 'defs/common_defs';
import { useTranslation } from 'react-i18next';
import { useAddressCheck } from 'hooks/common/useAddrCheck';
import { useWalletInfo } from 'stores/localStore/walletInfo';
import { checkErrorInfo } from './utils';
import { useBtnStatus } from 'hooks/common/useBtnStatus';
import { useModalData } from 'stores/router';
import { isAccActivated } from './checkAccStatus';
import { getFloatValue } from 'utils/formatter_tool';
    import { ErrorMsg, UserNFTBalanceInfo } from '@loopring-web/loopring-sdk';
import { NFTTokenInfo } from '@loopring-web/loopring-sdk';
import { useChargeNFTFees } from '../common/useChargeNFTFees';

export const useNFTTransfer = <R extends IBData<T> & Partial<NFTTokenInfo & UserNFTBalanceInfo & NFTWholeINFO>,T>(
    {isLocalShow = false,doTransferDone}: { isLocalShow?: boolean, doTransferDone?:()=>void }
): {
    nftTransferToastOpen: boolean,
    nftTransferAlertText: any,
    setNFTTransferToastOpen: any,
    nftTransferProps: TransferProps<R, T>,
    processRequestNFT: any,
    lastNFTRequest: any,

} => {

    const { setShowAccount, setShowNFTTransfer, } = useOpenModals()

    const [nftTransferToastOpen, setNFTTransferToastOpen] = React.useState<boolean>(false)

    const [nftTransferAlertText, setNFTTransferAlertText] = React.useState<string>()

    const { modals: { isShowNFTTransfer: {  nftData, nftBalance,...nftRest } } } = useOpenModals()

    const { tokenMap, totalCoinMap, } = useTokenMap();
    const { account, status: accountStatus, } = useAccount()
    const { exchangeInfo, chainId } = useSystem();

    const { nftTransferValue, updateNFTTransferData, resetNFTTransferData, } = useModalData()

    const [walletMap, setWalletMap] = React.useState(makeWalletLayer2(true).walletMap ?? {} as WalletMap<R>);
    const { chargeFeeList } = useChargeNFTFees({
        tokenAddress: nftTransferValue.tokenAddress, requestType: sdk.OffchainNFTFeeReqType.NFT_TRANSFER, tokenMap,
        needRefresh:true})

    const [nftTransferFeeInfo, setNFTTransferFeeInfo] = React.useState<FeeInfo>()
    const [isExceedMax, setIsExceedMax] = React.useState(false)

    const {
        address,
        realAddr,
        setAddress,
        addrStatus,
    } = useAddressCheck()

    const { btnStatus, enableBtn, disableBtn, } = useBtnStatus()

    const checkBtnStatus = React.useCallback(() => {
        if (!tokenMap || !nftTransferFeeInfo?.belong || !nftTransferValue?.tradeValue || !address) {
            disableBtn()
            return
        }

        // const sellToken = tokenMap[nftTransferValue.belong as string]

        const tradeValue = sdk.toBig(nftTransferValue.tradeValue)
        
        if (chargeFeeList && chargeFeeList?.length > 0 && !!address && tradeValue.gt(BIGO)
            && tradeValue.lte(nftTransferValue.nftBalance??0)
            && addrStatus === AddressError.NoError && !isExceedMax) {
            enableBtn()
        } else {
            disableBtn()
        }

    }, [enableBtn,
        disableBtn,
        address,
        addrStatus, chargeFeeList, nftTransferFeeInfo, nftTransferValue, isExceedMax, ])

    React.useEffect(() => {
        
        checkBtnStatus()

    }, [ chargeFeeList,
        address, addrStatus,
        nftTransferValue?.tradeValue, isExceedMax ])

    const walletLayer2Callback = React.useCallback(() => {
        const walletMap = makeWalletLayer2(true).walletMap ?? {} as WalletMap<R>
        setWalletMap(walletMap)
    }, [])

    useWalletLayer2Socket({ walletLayer2Callback })

    const resetDefault = React.useCallback(() => {

        if (nftData) {
            updateNFTTransferData({
                belong: nftData as any,
                balance:  nftBalance,
                tradeValue: undefined,
                ...nftRest,
                address: address? address:"*",
            })
        } else {
            updateNFTTransferData({
                belong: '',
                balance:  0,
                tradeValue: 0,
                address: "*",
            })
            setShowNFTTransfer({isShow:false})
        }
        // if (symbol && walletMap) {
        //     myLog('resetDefault symbol:', symbol)
        //     updateTransferData({
        //         belong: symbol as any,
        //         balance: walletMap[symbol]?.count,
        //         tradeValue: undefined,
        //         address: "*",
        //     })
        // } else {
        //     if (!nftTransferValue.belong && walletMap) {
        //         const keys = Reflect.ownKeys(walletMap)
        //         for (var key in keys) {
        //             const keyVal = keys[key]
        //             const walletInfo = walletMap[keyVal]
        //             if (sdk.toBig(walletInfo.count).gt(0)) {
        //                 updateTransferData({
        //                     belong: keyVal as any,
        //                     tradeValue: 0,
        //                     balance: walletInfo.count,
        //                     address: "*",
        //                 })
        //                 break
        //             }
        //         }
        //     }
        //
        // }
    }, [address,nftData,nftBalance, walletMap, updateNFTTransferData, nftTransferValue])

    //TODO NO pop is pop add isShow
    React.useEffect(() => {
        if ( isLocalShow) {
            resetDefault()
        }
    }, [isLocalShow])

    React.useEffect(() => {

        if (accountStatus === SagaStatus.UNSET && account.readyState === AccountStatus.ACTIVATED) {
            myLog('useEffect nftTransferValue.address:', nftTransferValue.address)
            setAddress(nftTransferValue.address ? nftTransferValue.address : '')
        }

    }, [setAddress, nftTransferValue.address, accountStatus, account.readyState])

    const { checkHWAddr, updateHW, } = useWalletInfo()

    const [lastNFTRequest, setLastNFTRequest] = React.useState<any>({})

    const processRequestNFT = React.useCallback(async (request: sdk.OriginNFTTransferRequestV3, isFirstTime: boolean) => {

        const { apiKey, connectName, eddsaKey,accountId } = account

        try {

            if (connectProvides.usedWeb3) {

                let isHWAddr = checkHWAddr(account.accAddress)

                isHWAddr = !isFirstTime ? !isHWAddr : isHWAddr

                const response = await LoopringAPI.userAPI?.submitNFTInTransfer({
                    request,
                    web3: connectProvides.usedWeb3,
                    chainId: chainId !== sdk.ChainId.GOERLI ? sdk.ChainId.MAINNET : chainId,
                    walletType: connectName as sdk.ConnectorNames,
                    eddsaKey: eddsaKey.sk,
                    apiKey,
                    isHWAddr,
                })

                myLog('submitInternalTransfer:', response)


                if (isAccActivated()) {

                    if ((response as sdk.ErrorMsg)?.errMsg ) {
                        // Withdraw failed
                        const code = checkErrorInfo(response, isFirstTime)
                        if (code === sdk.ConnectorError.USER_DENIED) {
                            setShowAccount({ isShow: true, step: AccountStep.Transfer_User_Denied })
                        } else if (code === sdk.ConnectorError.NOT_SUPPORT_ERROR) {
                            setLastNFTRequest({ request })
                            setShowAccount({ isShow: true, step: AccountStep.Transfer_First_Method_Denied })
                        } else {
                            setShowAccount({ isShow: true, step: AccountStep.Transfer_Failed })
                        }
                    } else if ((response as sdk.TX_HASH_RESULT<sdk.TX_HASH_API>)?.resultInfo) {
                        setShowAccount({ isShow: true, step: AccountStep.Transfer_Failed })
                    } else {
                        // Withdraw success
                        setShowAccount({ isShow: true, step: AccountStep.Transfer_In_Progress })
                        await sdk.sleep(TOAST_TIME)
                        setShowAccount({ isShow: true, step: AccountStep.Transfer_Success })
                        if (isHWAddr) {
                            myLog('......try to set isHWAddr', isHWAddr)
                            updateHW({ wallet: account.accAddress, isHWAddr })
                        }
                        walletLayer2Service.sendUserUpdate()
                        if(doTransferDone ){
                            doTransferDone()
                        }
                        resetNFTTransferData()


                    }
                } else {

                    resetNFTTransferData()
                }


            }

        } catch (reason) {
            const code = checkErrorInfo(reason, isFirstTime)

            if (isAccActivated()) {
                if (code === sdk.ConnectorError.USER_DENIED) {
                    setShowAccount({ isShow: true, step: AccountStep.Transfer_User_Denied })
                } else if (code === sdk.ConnectorError.NOT_SUPPORT_ERROR) {
                    setLastNFTRequest({ request })
                    setShowAccount({ isShow: true, step: AccountStep.Transfer_First_Method_Denied })
                } else {
                    setShowAccount({ isShow: true, step: AccountStep.Transfer_Failed })
                }
            }

        }
    }, [setLastNFTRequest, setShowAccount, updateHW, account,])

    const onTransferClick = useCallback(async (nftTransferValue, isFirstTime: boolean = true) => {
        const { accountId, accAddress, readyState, apiKey, eddsaKey } = account

        if (readyState === AccountStatus.ACTIVATED && tokenMap && LoopringAPI.userAPI
            && exchangeInfo && connectProvides.usedWeb3
            && nftTransferValue?.nftData && nftTransferFeeInfo?.belong && eddsaKey?.sk) {

            try {

                setShowNFTTransfer({ isShow: false })
                setShowAccount({ isShow: true, step: AccountStep.Transfer_WaitForAuth })
                // const sellTokenID = nftTransferValue.tokenId

                // const sellToken = tokenMap[nftTransferValue.belong as string]
                const feeToken = tokenMap[nftTransferFeeInfo.belong]
                const fee = sdk.toBig(nftTransferFeeInfo.__raw__.feeRaw ?? 0)
                const tradeValue = nftTransferValue.tradeValue;
                const balance = nftTransferValue.nftBalance;
                const isExceedBalance =  sdk.toBig(tradeValue).gt(balance)

                if(isExceedBalance){
                    throw Error('overflow balance')
                }
                // isExceedBalance?
                // const isExceedBalance = feeToken.tokenId === sellToken.tokenId && tradeValue.plus(fee).gt(balance)
                // const finalVol = tradeValue;
                // const nftTransferVol = tradeValue

                const storageId = await LoopringAPI.userAPI?.getNextStorageId({
                    accountId,
                    sellTokenId: nftTransferValue.tokenId
                }, apiKey)
                const req: sdk.OriginNFTTransferRequestV3 = {
                    exchange: exchangeInfo.exchangeAddress,
                    fromAccountId: accountId,
                    fromAddress: accAddress,
                    toAccountId: 0,
                    toAddress: realAddr ? realAddr : address,
                    storageId: storageId?.offchainId,
                    token: {
                        tokenId: nftTransferValue.tokenId,
                        nftData: nftTransferValue.nftData,
                        amount: tradeValue,
                    },
                    maxFee: {
                        tokenId: feeToken.tokenId,
                        amount: fee.toString(),
                    },
                    validUntil: getTimestampDaysLater(DAYS),
                    memo: nftTransferValue.memo,
                }

                myLog('nftTransfer req:', req)

                processRequestNFT(req, isFirstTime)

            } catch (e) {
                sdk.dumpError400(e)
                // nftTransfer failed
                setShowAccount({ isShow: true, step: AccountStep.Transfer_Failed })
            }

        } else {
            return false
        }

    }, [processRequestNFT, account, tokenMap, nftTransferFeeInfo?.belong, nftTransferValue, address, realAddr])

    const handlePanelEvent = useCallback(async (data: SwitchData<R>, switchType: 'Tomenu' | 'Tobutton') => {
        return new Promise<void>((res: any) => {
            if (data.to === 'button') {
                if (data.tradeData.belong) {
                    updateNFTTransferData({
                        tradeValue: data.tradeData?.tradeValue,
                        balance: data.tradeData.nftBalance,
                        address: '*',
                    })
                } else {
                    updateNFTTransferData({
                        belong: undefined, 
                        tradeValue: undefined, 
                        balance: undefined,
                        address: '*', })
                }
            }

            res();
        })
    }, [updateNFTTransferData, nftTransferValue])

    const handleFeeChange = useCallback((value: FeeInfo): void => {
        setNFTTransferFeeInfo(value)
    }, [setNFTTransferFeeInfo])

    const { t } = useTranslation()

    const nftTransferProps = {
        addressDefault: address,
        realAddr,
        tradeData: nftTransferValue as any,
        coinMap: totalCoinMap as CoinMap<T>,
        walletMap: walletMap as WalletMap<T>,
        transferBtnStatus: btnStatus,
        onTransferClick,
        handleFeeChange,
        handlePanelEvent,
        chargeFeeToken: nftTransferFeeInfo?.belong,
        chargeFeeTokenList: chargeFeeList,
        handleOnAddressChange: (value: any) => {
        },
        handleError: ({ belong, balance, tradeValue }: any) => {
            balance = getFloatValue(balance)
            tradeValue = getFloatValue(tradeValue)
            // myLog(belong, balance, tradeValue, (tradeValue > 0 && balance < tradeValue) || (!!tradeValue && !balance))
            if ((balance > 0 && balance < tradeValue) || (tradeValue && !balance)) {
                setIsExceedMax(true)
                return { error: true, message: t('tokenNotEnough', { belong, }) }
            }
            setIsExceedMax(false)
            return { error: false, message: '' }
        },
        handleAddressError: (value: any) => {
            updateNFTTransferData({ address: value, balance: -1, tradeValue: -1 })
            return { error: false, message: '' }
        }
    }

    return {
        nftTransferToastOpen,
        nftTransferAlertText,
        setNFTTransferToastOpen,
        nftTransferProps,
        processRequestNFT,
        lastNFTRequest,
    }
}
