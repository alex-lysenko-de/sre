export function logApi(action, result) {
    console.group(`🪵 [${action}]`);
    if (result.error) {
        console.error('❌ Error:', result.error);
    } else {
        console.log('✅ Data:', result.data);
    }
    console.trace();
    console.groupEnd();
}