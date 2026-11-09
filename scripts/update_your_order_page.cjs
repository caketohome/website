const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/app/(checkout)/your-order/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';

// 1. Remove duplicate import
content = content.replace(
  'import { OrderLiveStatusWatcher } from "@frontend/components/store/order/order-live-status-watcher";' + eol +
  'import { OrderLiveStatusWatcher } from "@frontend/components/store/order/order-live-status-watcher";',
  'import { OrderLiveStatusWatcher } from "@frontend/components/store/order/order-live-status-watcher";'
);

// 2. Add Cashfree Payment Ref in metadata card
const targetBlock = ' <div>' + eol +
  ' <span className="text-ash font-medium">Payment Mode</span>' + eol +
  ' <p className="font-bold text-pearl mt-0.5">' + eol +
  ' {order.payment_method || "Online"}' + eol +
  ' </p>' + eol +
  ' <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">' + eol +
  ' {order.payment_status === "pending" ? "Pending on Delivery" : "Captured"}' + eol +
  ' </span>' + eol +
  ' </div>';

const enhancedBlock = ' <div>' + eol +
  ' <span className="text-ash font-medium">Payment Mode</span>' + eol +
  ' <p className="font-bold text-pearl mt-0.5">' + eol +
  ' {order.payment_method || "Cashfree Online PG"}' + eol +
  ' </p>' + eol +
  ' <div className="flex flex-col gap-1 mt-1">' + eol +
  ' <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold w-fit">' + eol +
  ' {order.payment_status === "pending" ? "Pending on Delivery" : "Captured (Paid)"}' + eol +
  ' </span>' + eol +
  ' {(order.transaction_id || order.payment?.transaction_id || order.metadata?.cf_payment_id) && (' + eol +
  ' <span className="text-[10px] font-mono text-ash truncate" title={order.transaction_id || order.payment?.transaction_id}>' + eol +
  ' CF Ref: {order.transaction_id || order.payment?.transaction_id || order.metadata?.cf_payment_id}' + eol +
  ' </span>' + eol +
  ' )}' + eol +
  ' </div>' + eol +
  ' </div>';

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, enhancedBlock);
  console.log('Successfully enhanced payment card in your-order/page.tsx');
} else {
  console.log('Searching for payment block with flexible regex...');
  content = content.replace(
    /<span className="text-ash font-medium">Payment Mode<\/span>[\s\S]*?\{order\.payment_status === "pending" \? "Pending on Delivery" : "Captured"\}[\s\S]*?<\/span>[\s\r\n]*<\/div>/,
    `<span className="text-ash font-medium">Payment Mode</span>${eol} <p className="font-bold text-pearl mt-0.5">${eol} {order.payment_method || "Cashfree Online PG"}${eol} </p>${eol} <div className="flex flex-col gap-1 mt-1">${eol} <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold w-fit">${eol} {order.payment_status === "pending" ? "Pending on Delivery" : "Captured (Paid)"}${eol} </span>${eol} {(order.transaction_id || order.payment?.transaction_id || order.metadata?.cf_payment_id) && (${eol} <span className="text-[10px] font-mono text-ash truncate">${eol} CF Ref: {order.transaction_id || order.payment?.transaction_id || order.metadata?.cf_payment_id}${eol} </span>${eol} )}${eol} </div>${eol} </div>`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated your-order/page.tsx successfully');

