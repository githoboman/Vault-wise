const address = 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E';
const contract = 'vault-v3';
const userKey = '0x051a135cb6332a4c9f3cdc90a9866f6ade9aeaf175d3'; // standardPrincipalCV hex

async function verifyContract() {
    const url = `https://api.testnet.hiro.so/v2/contracts/call-read/${address}/${contract}/get-vault`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: address,
                arguments: [userKey]
            })
        });
        const data = await response.json();
        console.log('Contract Check Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

verifyContract();
