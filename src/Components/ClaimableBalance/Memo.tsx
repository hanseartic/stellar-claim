import {ReactNode, useEffect, useState} from "react";
import {useTransactions} from ".";
import {Skeleton} from "antd";

const loadingIndicator = <Skeleton title={false} paragraph={{rows: 1}} avatar={false} round active />;
const Memo = ({claimableBalanceId}: {claimableBalanceId: string}) => {
    const [memo, setMemo] = useState<ReactNode>(loadingIndicator);
    const useTransactionsResult = useTransactions(claimableBalanceId);
    useEffect(() => {
        switch (useTransactionsResult.state) {
            case "loaded":
                const transactionMemo = useTransactionsResult.transactions.find(t => t.memo !== undefined && t.memo_type === "text")?.memo
                setMemo(transactionMemo);
                break;
            case "error":
                setMemo("memo could not be loaded")
                break;
        }
    }, [useTransactionsResult]);

    return <pre style={{maxWidth: '32ch', color: useTransactionsResult.state==='error'?'lightgray':undefined}}>{memo}</pre>
}

export default Memo;
