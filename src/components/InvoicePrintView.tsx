import type { InvoiceDocument } from '../types/invoice';

interface Props {
  invoice: InvoiceDocument;
  currencySymbol: string;
}

function locationStr(loc: { city: string; state: string; country: string; pincode: string }) {
  return [loc.city, loc.state, loc.pincode, loc.country].filter(Boolean).join(', ');
}

export default function InvoicePrintView({ invoice, currencySymbol }: Props) {
  const deliveryAddress = invoice.deliverySameAsBilling
    ? invoice.clientAddress
    : invoice.deliveryAddress;
  const deliveryLocation = invoice.deliverySameAsBilling
    ? invoice.clientLocation
    : invoice.deliveryLocation;
  // GST is India-only. Non-Indian sellers see a single "Tax Amount" row instead of CGST/SGST/IGST.
  const isIndianSeller = (invoice.companyLocation?.country ?? '').trim().toUpperCase() === 'IN';
  const totalTax = invoice.totalCGST + invoice.totalSGST + invoice.totalIGST;

  return (
    <div
      id="invoice-print-area"
      className="bg-white w-full font-sans"
      style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}
    >
      {/* Header — table-based so email clients (Gmail/Outlook) render the
          two-column split reliably; flex/grid are unreliable in many MUAs. */}
      <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px solid #e2e8f0' }}>
        <tbody>
          <tr>
            <td style={{ padding: '28px 36px', verticalAlign: 'top', width: '60%' }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    {invoice.companyLogo && (
                      <td style={{ verticalAlign: 'top', paddingRight: '16px' }}>
                        <img src={invoice.companyLogo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '4px', display: 'block' }} />
                      </td>
                    )}
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{invoice.companyName || 'Your Company'}</div>
                      {invoice.companyAddress && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{invoice.companyAddress}</div>}
                      {locationStr(invoice.companyLocation) && <div style={{ fontSize: '12px', color: '#64748b' }}>{locationStr(invoice.companyLocation)}</div>}
                      {invoice.companyGst && <div style={{ fontSize: '12px', color: '#64748b' }}>GST: <strong>{invoice.companyGst}</strong></div>}
                      {invoice.companyEmail && <div style={{ fontSize: '12px', color: '#64748b' }}>{invoice.companyEmail}</div>}
                      {invoice.companyPhone && <div style={{ fontSize: '12px', color: '#64748b' }}>{invoice.companyPhone}</div>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={{ padding: '28px 36px', verticalAlign: 'top', textAlign: 'right', width: '40%' }}>
              <div style={{ display: 'inline-block', border: '2px solid #2563eb', borderRadius: '10px', padding: '6px 22px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.12em' }}>
                  {invoice.isExport ? 'EXPORT INVOICE' : 'INVOICE'}
                </span>
              </div>
              {invoice.isExport && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-block', fontSize: '10px', fontWeight: 700,
                    color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0',
                    borderRadius: '999px', padding: '2px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    GST Exempt · Zero Rated Supply
                  </span>
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#64748b' }}><strong style={{ color: '#0f172a' }}>#</strong> {invoice.invoiceNumber || '—'}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>Date: <strong style={{ color: '#0f172a' }}>{invoice.invoiceDate || '—'}</strong></div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Due: <strong style={{ color: '#0f172a' }}>{invoice.dueDate || '—'}</strong></div>
              {invoice.poNumber && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>PO No: <strong style={{ color: '#0f172a' }}>{invoice.poNumber}</strong></div>}
              {invoice.projectName && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Project: <strong style={{ color: '#0f172a' }}>{invoice.projectName}</strong></div>}
              {invoice.eWayBillNumber && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>E-Way Bill: <strong style={{ color: '#0f172a' }}>{invoice.eWayBillNumber}</strong></div>}
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Currency: <strong style={{ color: '#0f172a' }}>{invoice.currency}</strong></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bill To + Ship To — table for reliable two-column rendering in email. */}
      <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #e2e8f0' }}>
        <tbody>
          <tr>
            <td style={{ padding: '20px 20px 16px 36px', verticalAlign: 'top', width: '50%' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Bill To</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{invoice.clientName || '—'}</div>
              {invoice.clientAddress && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{invoice.clientAddress}</div>}
              {locationStr(invoice.clientLocation) && <div style={{ fontSize: '12px', color: '#64748b' }}>{locationStr(invoice.clientLocation)}</div>}
              {invoice.clientGst && <div style={{ fontSize: '12px', color: '#64748b' }}>GST: <strong>{invoice.clientGst}</strong></div>}
              {invoice.clientEmail && <div style={{ fontSize: '12px', color: '#64748b' }}>{invoice.clientEmail}</div>}
              {invoice.clientPhone && <div style={{ fontSize: '12px', color: '#64748b' }}>{invoice.clientPhone}</div>}
            </td>
            <td style={{ padding: '20px 36px 16px 20px', verticalAlign: 'top', width: '50%' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Ship To</div>
              {invoice.siteName && <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>{invoice.siteName}</div>}
              {deliveryAddress && <div style={{ fontSize: '12px', color: '#64748b' }}>{deliveryAddress}</div>}
              {locationStr(deliveryLocation) && <div style={{ fontSize: '12px', color: '#64748b' }}>{locationStr(deliveryLocation)}</div>}
              {invoice.deliverySameAsBilling && !invoice.siteName && !deliveryAddress && <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Same as billing address</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Transport Details — only shown if at least one field is filled */}
      {(invoice.transportName || invoice.vehicleNumber) && (
        <div style={{ padding: '10px 36px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '40px', background: '#f8fafc' }}>
          {invoice.transportName && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transport: </span>
              <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>{invoice.transportName}</span>
            </div>
          )}
          {invoice.vehicleNumber && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vehicle No: </span>
              <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>{invoice.vehicleNumber}</span>
            </div>
          )}
        </div>
      )}

      {/* Line Items Table */}
      <div style={{ padding: '20px 36px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {[
                '#', 'Description', 'HSN', 'UOM', 'Qty', `Rate (${currencySymbol})`,
                ...(invoice.isExport ? [] : ['Tax %', `Tax Amt (${currencySymbol})`]),
                `Amount (${currencySymbol})`,
              ].map((h) => {
                const leftAligned = h === '#' || h === 'Description' || h === 'HSN' || h === 'UOM';
                return (
                  <th key={h} style={{ padding: '10px 10px', textAlign: leftAligned ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, idx) => (
              <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '9px 10px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ padding: '9px 10px', fontSize: '13px', color: '#1e293b' }}>{item.description || '—'}</td>
                <td style={{ padding: '9px 10px', fontSize: '12px', color: '#64748b' }}>{item.hsnCode || '—'}</td>
                <td style={{ padding: '9px 10px', fontSize: '12px', color: '#64748b' }}>{item.uom}</td>
                <td style={{ padding: '9px 10px', fontSize: '13px', color: '#1e293b', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '9px 10px', fontSize: '13px', color: '#1e293b', textAlign: 'right' }}>{currencySymbol}{item.unitRate.toFixed(2)}</td>
                {!invoice.isExport && (() => {
                  const splitTax = (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0) + (item.igstAmount ?? 0);
                  const fallbackBase = item.taxableAmount ?? (item.quantity || 0) * (item.unitRate || 0);
                  const taxAmt = splitTax > 0 ? splitTax : (fallbackBase * (item.taxRate ?? 0)) / 100;
                  return (
                    <>
                      <td style={{ padding: '9px 10px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>{(item.taxRate ?? 0).toFixed(0)}%</td>
                      <td style={{ padding: '9px 10px', fontSize: '13px', color: '#1e293b', textAlign: 'right' }}>{currencySymbol}{taxAmt.toFixed(2)}</td>
                    </>
                  );
                })()}
                <td style={{ padding: '9px 10px', fontSize: '13px', fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>{currencySymbol}{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Additional Charges */}
      {invoice.additionalCharges.length > 0 && (
        <div style={{ padding: '0 36px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Additional Charges</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {invoice.additionalCharges.map((charge) => (
                <tr key={charge._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontSize: '13px', color: '#64748b' }}>{charge.label || charge.type}</td>
                  <td style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>{currencySymbol}{charge.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes + Totals — laid out as a <table> with two <td>s. Flexbox is
          unreliable in email clients (Gmail strips `display: flex`), so a
          table guarantees Notes-on-left + Totals-on-right in both the printed
          preview AND the embedded HTML mail body. */}
      <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '0 12px 28px 36px', verticalAlign: 'top', width: '55%' }}>
              {invoice.notes && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Notes</div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{invoice.notes}</div>
                </>
              )}
            </td>
            <td style={{ padding: '0 36px 28px 12px', verticalAlign: 'top', width: '45%' }}>
        <div style={{ minWidth: '260px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Subtotal</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{invoice.subtotal.toFixed(2)}</span>
          </div>
          {(invoice.discountAmount ?? 0) > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Discount {invoice.discountType === 'percentage' ? `(${invoice.discountValue}%)` : ''}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>−{currencySymbol}{(invoice.discountAmount ?? 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Taxable Amount</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{(invoice.discountedSubtotal ?? invoice.subtotal).toFixed(2)}</span>
              </div>
            </>
          )}
          {!invoice.isExport && isIndianSeller && (invoice.isIntraState ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>CGST</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>SGST</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{invoice.totalSGST.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>IGST</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
            </div>
          ))}
          {!invoice.isExport && !isIndianSeller && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Tax Amount</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{totalTax.toFixed(2)}</span>
            </div>
          )}
          {invoice.isExport && isIndianSeller && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
              <span style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>GST Exempt · Zero Rated Supply</span>
              <span style={{ fontSize: '12px', color: '#047857', fontWeight: 700 }}>{currencySymbol}0.00</span>
            </div>
          )}
          {invoice.additionalChargesTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Additional Charges</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{currencySymbol}{invoice.additionalChargesTotal.toFixed(2)}</span>
            </div>
          )}
          {invoice.roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Round Off</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{invoice.roundOff >= 0 ? '+' : ''}{invoice.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#1d4ed8' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</span>
            <span style={{ fontSize: '17px', fontWeight: 900, color: '#fff' }}>{currencySymbol}{invoice.grandTotal.toFixed(2)}</span>
          </div>
          <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
              Amount in Words: <strong>{amountInWords(invoice.grandTotal, invoice.currency)}</strong>
            </span>
          </div>
        </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Payment Method */}
      {invoice.paymentMethod && (
        <div style={{ padding: '0 36px 16px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Payment Method: <strong style={{ color: '#1e293b' }}>{invoice.paymentMethod}</strong></span>
        </div>
      )}

      {/* Bank / Account Details — only shown when the required fields are present */}
      {invoice.accountDetails
        && invoice.accountDetails.accountHolderName
        && invoice.accountDetails.bankName
        && invoice.accountDetails.accountNumber
        && invoice.accountDetails.ifscCode && (
        <div style={{ padding: '0 36px 16px' }}>
          <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb', borderRadius: '6px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    Bank Account Details
                  </div>
                  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#334155' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 0', width: '38%', color: '#64748b' }}>Account Holder</td>
                        <td style={{ padding: '2px 0', fontWeight: 600 }}>{invoice.accountDetails.accountHolderName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 0', color: '#64748b' }}>Bank</td>
                        <td style={{ padding: '2px 0', fontWeight: 600 }}>{invoice.accountDetails.bankName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 0', color: '#64748b' }}>Account Number</td>
                        <td style={{ padding: '2px 0', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{invoice.accountDetails.accountNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 0', color: '#64748b' }}>IFSC Code</td>
                        <td style={{ padding: '2px 0', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{invoice.accountDetails.ifscCode}</td>
                      </tr>
                      {invoice.accountDetails.branchName && (
                        <tr>
                          <td style={{ padding: '2px 0', color: '#64748b' }}>Branch</td>
                          <td style={{ padding: '2px 0', fontWeight: 600 }}>{invoice.accountDetails.branchName}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Terms & Conditions */}
      {invoice.termsAndConditions && (
        <div style={{ padding: '0 36px 24px', borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Terms &amp; Conditions</div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{invoice.termsAndConditions}</div>
        </div>
      )}

      {/* Seal + Signature — table-aligned to the right for email compatibility. */}
      {(invoice.companySeal || invoice.signature) && (
        <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #e2e8f0' }}>
          <tbody>
            <tr>
              <td style={{ padding: '16px 36px 28px' }}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
                  <tbody>
                    <tr>
                      {invoice.companySeal && (
                        <td style={{ textAlign: 'center', padding: '0 24px', verticalAlign: 'top' }}>
                          <img src={invoice.companySeal} alt="Company Seal" style={{ width: '80px', height: '80px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Company Seal</div>
                        </td>
                      )}
                      {invoice.signature && (
                        <td style={{ textAlign: 'center', padding: '0 24px', verticalAlign: 'top' }}>
                          <img src={invoice.signature} alt="Signature" style={{ width: '120px', height: '60px', objectFit: 'contain', borderBottom: '1px solid #cbd5e1', display: 'block', margin: '0 auto' }} />
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Authorised Signature</div>
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Footer */}
      <div style={{ padding: '12px 36px', textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          Thank you for your business — {invoice.companyName || 'Your Company'}
        </span>
      </div>
    </div>
  );
}

const CURRENCY_WORD_UNITS: Record<string, { major: string; minor: string; indian: boolean }> = {
  INR: { major: 'Rupees', minor: 'Paise', indian: true },
  USD: { major: 'Dollars', minor: 'Cents', indian: false },
  EUR: { major: 'Euros', minor: 'Cents', indian: false },
  GBP: { major: 'Pounds', minor: 'Pence', indian: false },
  AED: { major: 'Dirhams', minor: 'Fils', indian: false },
  SGD: { major: 'Singapore Dollars', minor: 'Cents', indian: false },
  JPY: { major: 'Yen', minor: 'Sen', indian: false },
  CNY: { major: 'Yuan', minor: 'Fen', indian: false },
  CAD: { major: 'Canadian Dollars', minor: 'Cents', indian: false },
  AUD: { major: 'Australian Dollars', minor: 'Cents', indian: false },
};

function amountInWords(amount: number, currencyCode: string): string {
  const units = CURRENCY_WORD_UNITS[currencyCode] ?? { major: currencyCode, minor: 'Cents', indian: false };
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (amount === 0) return `Zero ${units.major} Only`;

  const [intPart, decPart] = Math.abs(amount).toFixed(2).split('.');
  const n = parseInt(intPart, 10);
  const minor = parseInt(decPart, 10);

  function below1000(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '') + ' ';
    return ones[Math.floor(num / 100)] + ' Hundred ' + below1000(num % 100);
  }

  function indian(num: number): string {
    if (num === 0) return '';
    if (num < 1000) return below1000(num);
    if (num < 100000) return below1000(Math.floor(num / 1000)) + 'Thousand ' + below1000(num % 1000);
    if (num < 10000000) return below1000(Math.floor(num / 100000)) + 'Lakh ' + indian(num % 100000);
    return below1000(Math.floor(num / 10000000)) + 'Crore ' + indian(num % 10000000);
  }

  function western(num: number): string {
    if (num === 0) return '';
    if (num < 1000) return below1000(num);
    if (num < 1_000_000) return below1000(Math.floor(num / 1000)) + 'Thousand ' + below1000(num % 1000);
    if (num < 1_000_000_000) return western(Math.floor(num / 1_000_000)) + 'Million ' + western(num % 1_000_000);
    return western(Math.floor(num / 1_000_000_000)) + 'Billion ' + western(num % 1_000_000_000);
  }

  const convert = units.indian ? indian : western;
  let result = (amount < 0 ? 'Minus ' : '') + convert(n).trim() + ' ' + units.major;
  if (minor > 0) result += ' and ' + below1000(minor).trim() + ' ' + units.minor;
  return result + ' Only';
}
