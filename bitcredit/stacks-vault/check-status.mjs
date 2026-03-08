const address = 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E';
const contract = 'vault-v2';
const map = 'vaults';
const keyCV = '0x051a135cb6332a4c9f3cdc90a9866f6ade9aeaf175d3';

async function checkMap() {
    const url = `https://api.testnet.hiro.so/v2/contracts/call-read/${address}/${contract}/get-vault`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: address,
            arguments: [keyCV]
        })
    });
    const data = await response.json();
    console.log('Get Vault Result:', JSON.stringify(data, null, 2));

    const nonceUrl = `https://api.testnet.hiro.so/v2/contracts/call-read/${address}/${contract}/get-nonce-counter`;
    const nonceRes = await fetch(nonceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: address, arguments: [] })
    });
    const nonceData = await nonceRes.json();
    console.log('Nonce Counter Result:', JSON.stringify(nonceData, null, 2));
}

checkMap().catch(console.error);
