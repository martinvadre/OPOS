const defaultManualPayments = ['Scan', 'EDC'];

const manualPayments = data => Array.isArray(data.manualPayments) ? data.manualPayments : defaultManualPayments;
const promptpayEnabled = (data, promptpayId) => data.promptpayEnabled === undefined ? !!promptpayId : data.promptpayEnabled;
const validManualPayments = value => Array.isArray(value) && value.length <= 8 && value.every(name => typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 30 && !/[\r\n\t]/.test(name) && !['cash', 'promptpay'].includes(name.trim().toLowerCase())) && new Set(value.map(name => name.trim().toLowerCase())).size === value.length;
const validPaymentCode = value => value === 'cash' || value === 'promptpay' || (typeof value === 'string' && value.startsWith('manual:') && value.length > 7 && value.length <= 37);
const paymentAvailable = (data, promptpayId, payment) => payment === 'cash' || (payment === 'promptpay' ? promptpayEnabled(data, promptpayId) && !!promptpayId : !promptpayEnabled(data, promptpayId) && typeof payment === 'string' && payment.startsWith('manual:') && manualPayments(data).includes(payment.slice(7)));

module.exports = { manualPayments, promptpayEnabled, validManualPayments, validPaymentCode, paymentAvailable };
