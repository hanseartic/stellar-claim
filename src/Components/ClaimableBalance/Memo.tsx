import {useEffect, useState} from "react";
import {useTransactions} from ".";

const Memo = ({claimableBalanceId}: {claimableBalanceId: string}) => {
    const [memo, setMemo] = useState<string>();
    const transactions = useTransactions(claimableBalanceId);
    useEffect(() => {
        if (transactions.length > 0) {
            const transactionMemo = transactions.find(t => t.memo !== undefined && t.memo_type === "text")?.memo
            if (transactionMemo) {
                console.log("setting memo: "+transactionMemo)
                setMemo(transactionMemo);
            }
        }
    }, [transactions]);

    return <pre style={{maxWidth: '28ch'}}>{memo}</pre>
}

export default Memo;
