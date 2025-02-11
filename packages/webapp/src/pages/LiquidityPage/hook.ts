import React from 'react';
import { useDeepCompareEffect } from 'react-use'
import { useAmmActivityMap } from 'stores/Amm/AmmActivityMap';
import { LoopringAPI } from 'api_wrapper';
import { AmmPoolActivityRule, LoopringMap } from '@loopring-web/loopring-sdk';
import { useAccount } from 'stores/account/hook';
import { useAmmMap } from 'stores/Amm/AmmMap';
import { SagaStatus } from '@loopring-web/common-resources';
import { AmmRecordRow } from '@loopring-web/component-lib';
import { useSystem } from 'stores/system';
import { useLocation } from 'react-router-dom'
import { getUserAmmTransaction, makeMyAmmMarketArray, volumeToCount, getRecentAmmTransaction } from 'hooks/help'
import { useTokenMap } from 'stores/token'
import { useWalletLayer2 } from 'stores/walletLayer2'

export const useAmmPool = <R extends { [ key: string ]: any }, I extends { [ key: string ]: any }>() => {
    const {ammActivityMap, status: ammActivityMapStatus} = useAmmActivityMap()
    const {addressIndex} = useTokenMap();
    const { forex } = useSystem()
    // const {account, status: accountStatus} = useAccount();
    const { status: walletLayer2Status } = useWalletLayer2();
    const {ammMap, getAmmMap} = useAmmMap();
    const [_ammActivityMap, setAmmActivityMap] = React.useState<LoopringMap<LoopringMap<AmmPoolActivityRule[]>> | undefined>(ammActivityMap)
    
    const [ammMarketArray, setAmmMarketArray] = React.useState<AmmRecordRow<R>[]>([]);
    const [ammTotal, setAmmTotal] = React.useState(0)
    const [myAmmMarketArray, setMyAmmMarketArray] = React.useState<AmmRecordRow<R>[]>([]);
    const [ammUserTotal, setAmmUserTotal] = React.useState(0)

    const [isLoading, setIsLoading] = React.useState(false)
    const [isRecentLoading, setIsRecentLoading] = React.useState(false)
    const [lpTokenList, setLpTokenList] = React.useState<{ addr: string; price: number; }[]>([])

    let routerLocation = useLocation()
    
    // init AmmMap at begin
    React.useEffect(() => {
        if (!ammMap || Object.keys(ammMap).length === 0) {
            getAmmMap();
        }
    }, []);

    React.useEffect(() => {
        if (ammActivityMapStatus === SagaStatus.UNSET) {
            setAmmActivityMap(ammActivityMap)
        }
    }, [ammActivityMapStatus])

    const getLpTokenList = React.useCallback(async () => {
        if (LoopringAPI.walletAPI) {
            const result = await LoopringAPI.walletAPI.getLatestTokenPrices()
            const list = Object.entries(result.tokenPrices).map(([addr, price]) => ({
                addr,
                price,
            }))
            setLpTokenList(list)
        }
        return []
    }, [])

    React.useEffect(() => {
        getLpTokenList()
    }, [getLpTokenList])

    const getLpTokenPrice = React.useCallback((market: string) => {
        if (addressIndex && !!lpTokenList.length) {
            const address = Object.entries(addressIndex).find(([_, token]) => token === market)?.[ 0 ]
            if (address && lpTokenList) {
                return lpTokenList.find((o) => o.addr === address)?.price
            }
            return undefined
        }
        return undefined
    }, [addressIndex, lpTokenList])

    const getUserAmmPoolTxs = React.useCallback(({
                                                     limit = 14,
                                                     offset = 0,
                                                 }) => {
        if (ammMap && forex) {
            const url = routerLocation.pathname
            const list = url.split('/')
            const market = list[ list.length - 1 ]

            const addr = ammMap[ 'AMM-' + market ]?.address

            if (addr) {
                setIsLoading(true)
                getUserAmmTransaction({
                    address: addr,
                    limit: limit,
                    offset,
                    txStatus: 'processed'
                })?.then((res) => {
                    let _myTradeArray = makeMyAmmMarketArray(market, res.userAmmPoolTxs)
    
                    const formattedArray = _myTradeArray.map((o: any) => {
                        const market = `LP-${o.coinA.simpleName}-${o.coinB.simpleName}`
                        const formattedBalance = Number(volumeToCount(market, o.totalBalance))
                        const price = getLpTokenPrice(market)
                        const totalDollar = (formattedBalance || 0) * (price || 0) as any;
                        const totalYuan = totalDollar * forex
                        return ({
                            ...o,
                            totalDollar: totalDollar,
                            totalYuan: totalYuan,
                        })
                    })
                    // setMyAmmMarketArray(_myTradeArray ? _myTradeArray : [])
                    setMyAmmMarketArray(formattedArray || [])
                    setAmmUserTotal(res.totalNum)
                    setIsLoading(false)
                })
            }
        }
    }, [ammMap, routerLocation.pathname, forex, getLpTokenPrice])

    const getRecentAmmPoolTxs = React.useCallback(({
        limit = 15,
        offset = 0,
    }) => {
        if (ammMap && forex) {
            const url = routerLocation.pathname
            const list = url.split('/')
            const market = list[list.length - 1]
            const addr = ammMap['AMM-' + market]?.address

            if (addr) {
                setIsRecentLoading(true)
                getRecentAmmTransaction({
                    address: addr,
                    limit: limit,
                    offset,
                })?.then(({ammPoolTrades, totalNum}) => {
                    let _tradeArray = makeMyAmmMarketArray(market, ammPoolTrades)
    
                    const formattedArray = _tradeArray.map((o: any) => {
                        const market = `LP-${o.coinA.simpleName}-${o.coinB.simpleName}`
                        const formattedBalance = Number(volumeToCount(market, o.totalBalance))
                        const price = getLpTokenPrice(market)
                        const totalDollar = (formattedBalance || 0) * (price || 0) as any;
                        const totalYuan = totalDollar * forex
                        return ({
                            ...o,
                            totalDollar: totalDollar,
                            totalYuan: totalYuan,
                        })
                    })
                    // setMyAmmMarketArray(_myTradeArray ? _myTradeArray : [])
                    setAmmMarketArray(formattedArray || [])
                    setAmmTotal(totalNum)
                    setIsRecentLoading(false)
                })
            }
        }
    }, [ammMap, routerLocation.pathname, forex, getLpTokenPrice])

    useDeepCompareEffect(() => {
        if (!!lpTokenList.length) {
            getUserAmmPoolTxs({})
            getRecentAmmPoolTxs({})
        }
    }, [getUserAmmPoolTxs, getRecentAmmPoolTxs, lpTokenList])

    React.useEffect(() => {
        if (walletLayer2Status === SagaStatus.UNSET) {
            getUserAmmPoolTxs({})
            getRecentAmmPoolTxs({})
        }
    }, [getUserAmmPoolTxs, getRecentAmmPoolTxs, walletLayer2Status]);

    return {
        ammActivityMap: _ammActivityMap,
        isMyAmmLoading: isLoading,
        isRecentLoading,
        ammMarketArray,
        ammTotal,
        myAmmMarketArray,
        ammUserTotal,
        getRecentAmmPoolTxs,
        getUserAmmPoolTxs,
    }

}

