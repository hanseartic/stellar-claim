import {visit} from 'unist-util-visit';
import {toHast} from 'mdast-util-to-hast';
import {toText} from 'hast-util-to-text';
import { shortAddress } from '../StellarHelpers';
import { Keypair } from 'stellar-sdk';
import { h } from 'hastscript';

export default function stellarAddressRemarkPlugin() {
  return (tree: any) => {
    visit (tree, ["textDirective"], (node) => {
      if (node.name !== 'stellar_address') return;
      const address = node.children.length === 1
        ? toText(toHast(node)??h(null))
        : Keypair.random().publicKey();
      const length = parseInt(node.attributes?.length ?? 56);
      if (length >= 56) {
        node.type = 'text';
        node.value = shortAddress(address, length);
        return;
      }
      const data = node.data || (node.data = {})
      node.data.hProperties = {
        title: address,
      }
      node.data.hName = 'abbr';
      node.children[0].value = shortAddress(address, length);
    })
  }
}
