import {ReactNode, useEffect, useState} from "react";
import {useTransactions} from ".";
import {Skeleton} from "antd";

const Memo = ({claimableBalanceId}: {claimableBalanceId: string}) => {
    const [memo, setMemo] = useState<ReactNode>(<Skeleton active title paragraph={false} round />);
    const transactions = useTransactions(claimableBalanceId);
    useEffect(() => {
        if (transactions.length > 0) {
            const transactionMemo = transactions.find(t => t.memo !== undefined && t.memo_type === "text")?.memo
            setMemo(transactionMemo);
        }
    }, [transactions]);

    return <pre style={{maxWidth: '32ch'}}>{memo}</pre>
}

export default Memo;
