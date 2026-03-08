const { serializeCV, standardPrincipalCV, deserializeCV, cvToJSON } = require('@stacks/transactions');

async function checkVault() {
    const owner = 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E';
    const body = JSON.stringify({
        sender: owner,
        arguments: ['0x' + Buffer.from(serializeCV(standardPrincipalCV(owner))).toString('hex')]
    });

    console.log("Checking vault for:", owner);
    try {
        const res = await fetch('https://api.testnet.hiro.so/v2/contracts/call-read/ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E/vault-v3/get-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        const d = await res.json();
        if (d.okay && d.result) {
            const cv = deserializeCV(Buffer.from(d.result.slice(2), 'hex'));
            console.log("Vault State:", JSON.stringify(cvToJSON(cv), null, 2));
        } else {
            console.log("Error response:", JSON.stringify(d, null, 2));
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

checkVault();
