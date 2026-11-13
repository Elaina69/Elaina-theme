// Manual check for the live client. Paste into DevTools (or run through any CDP eval).
// Counts DataStore.set calls for 30 s and logs them grouped by which ElainaTheme key changed.
// Idle on the homepage this should stay close to 0. Every call makes Pengu rewrite the whole
// datastore file, so a high count means a higher chance of a truncated file on a hard kill.
(() => {
    const original = DataStore.set;
    const counts = {};
    let last = JSON.stringify(DataStore.get('ElainaTheme', {}));

    DataStore.set = function (key, value) {
        let label = key;
        if (key === 'ElainaTheme') {
            const before = JSON.parse(last);
            last = JSON.stringify(value);
            const changed = Object.keys(value).filter((k) => JSON.stringify(value[k]) !== JSON.stringify(before[k]));
            label = 'ElainaTheme: ' + (changed.join(', ') || '(no change)');
        }
        counts[label] = (counts[label] ?? 0) + 1;
        return original.apply(this, arguments);
    };

    setTimeout(() => {
        DataStore.set = original;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        console.log(`DataStore.set calls in 30 s: ${total}`);
        console.table(counts);
    }, 30000);
})();
