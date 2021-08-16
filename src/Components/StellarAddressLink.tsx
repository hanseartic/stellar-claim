import {shortAddress} from '../StellarHelpers';
import React from 'react';
import { Link } from 'react-router-dom';

interface StellarAddressProps {
    id?: string,
    length?: number
}

export default function StellarAddressLink(props: StellarAddressProps) {
    return (<>
        <Link key={`account:${props.id}`}
              title={props.id}
              to={`/account/${props.id}`}>
            {shortAddress(props.id??'', props.length??56)}
        </Link>
    </>);
};
