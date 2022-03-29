type showDate = number|undefined;
type fallbackDate = showDate|string;
interface ValidDateProps {
    date: showDate,
    fallback: fallbackDate
}

const ValidDate = ({date, fallback}: ValidDateProps) => {
    const renderDate = (date: showDate): string => date
        ? new Date(date*1000).toLocaleString()
        : "";

    return (<>
        { date && renderDate(date) }
        { undefined === date && (typeof fallback === 'number' && (renderDate(fallback) || fallback)) }
    </>);
}

export default ValidDate;
