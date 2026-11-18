# /snack-receipts - Log snack receipts to Notion

Read every receipt in the snack receipts inbox, propose the items, and save each one to the Notion snack DB only after Shihyun approves it.

- Inbox: `10-projects/workplace/14-snack-dashboard/receipts/inbox/` (she drops screenshots or photos here)
- Saved receipts move to `receipts/logged/` automatically
- Notion DB: the snack DB in the project `.env` (`NOTION_SNACK_DB_ID`)

## Steps

1. List image files in the inbox (png, jpg, jpeg, heic, webp). If there are none, say so and stop. HEIC: convert with `sips -s format jpeg` into the scratchpad before reading.
2. For each receipt, one at a time:
   - Read the image and extract: purchase date, vendor, and every product with its final line total in KRW.
   - Vendor must be one of the DB options: 쿠팡, 마켓컬리, 배달의민족, 올리브영, 네이버, 뚜레주르, 매일유업, 스낵24. 네이버페이 / smartstore orders = 네이버.
   - Event defaults to `Office Snacks` unless the receipt clearly belongs to Happy Hour / Bi-weekly / Other Events; ask if unsure.
   - Leave out shipping, coupons, points and order-level discounts as separate items. If the paid total differs from the item sum, say by how much and ask whether to add a "배송비/기타" or "할인" line.
   - Use short, recognizable product names (match names already used in the DB where possible, e.g. 감귤, 루이보스, 하늘보리).
   - Show a compact table (item, price), the total, date, vendor, event. Ask: approve, edit, or skip.
3. On approval: write the purchase JSON to the scratchpad and run, from the project folder:
   `node --env-file=.env scripts/log-snacks.mjs <json>`
   - If it reports POSSIBLE DUPLICATES, show them and ask before re-running with `--force`.
   - On skip: leave the file in the inbox and move on.
4. At the end, summarize: receipts saved, rows added, total won, receipts skipped.

## Rules
- Never save without an explicit approval for that receipt.
- Never use "·" or em dashes in the summaries.
