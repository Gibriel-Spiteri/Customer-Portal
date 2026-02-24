import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, ShoppingCart, FileText } from "lucide-react";

export interface EstimateItem {
  id?: string;
  name: string;
  itemName?: string;
  description?: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface EstimateDetail {
  id: string;
  estimateNumber: string;
  status: string;
  amount: string;
  currency: string;
  estimateDate: string;
  expiryDate: string;
  description?: string;
  memo?: string;
  tagFor?: string;
  items?: EstimateItem[];
  totalAmount?: string;
  subtotal?: string;
  tax?: string;
  shipping?: string;
  discountTotal?: string;
  dataFreshness?: 'live' | 'cached';
  salesRepPreferredName?: string;
  customerName?: string;
  lastSyncAt?: string;
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    viewed: 'bg-purple-100 text-purple-800',
    open: 'bg-green-100 text-green-800',
    accepted: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const formatCurrency = (amount: string, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(parseFloat(amount));
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

interface EstimateDetailModalProps {
  estimate: EstimateDetail | null;
  loading: boolean;
  onClose: () => void;
}

export function EstimateDetailModal({ estimate, loading, onClose }: EstimateDetailModalProps) {
  return (
    <Dialog open={!!estimate} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Estimate #{estimate?.estimateNumber}</span>
            {estimate && (
              <Badge className={getStatusColor(estimate.status)}>
                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Details for estimate {estimate?.estimateNumber}
          </DialogDescription>
        </DialogHeader>
        
        {estimate && (
          <div className="space-y-6 mt-4">
            {(estimate.memo || estimate.tagFor || estimate.salesRepPreferredName) && (
              <div className="grid grid-cols-3 gap-4">
                {estimate.tagFor && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">End User</h3>
                    <p className="text-base">{estimate.tagFor}</p>
                  </div>
                )}
                {estimate.memo && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Job ID</h3>
                    <p className="text-base">{estimate.memo}</p>
                  </div>
                )}
                {estimate.salesRepPreferredName && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Sales Rep</h3>
                    <p className="text-base">{estimate.salesRepPreferredName}</p>
                  </div>
                )}
              </div>
            )}

            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Estimate Date</h3>
                <p className="text-base flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {formatDate(estimate.estimateDate)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h3>
                <p className="text-lg font-semibold">
                  {formatCurrency(estimate.amount || estimate.totalAmount || '0', estimate.currency)}
                </p>
              </div>
            </div>

            {loading ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Line Items
                  </h3>
                  <div className="animate-pulse space-y-2">
                    <div className="h-12 bg-gray-200 rounded"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </>
            ) : estimate.items && estimate.items.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Line Items
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const allItems = estimate.items || [];
                      
                      const displayItems = allItems.filter(item => {
                        const itemName = item.itemName || '';
                        const itemNameLower = itemName.toLowerCase();
                        const amount = parseFloat(String(item.amount || 0));
                        
                        const isTaxItem = itemName.includes('NY_') || 
                                         itemNameLower.includes('ny_suffolk') ||
                                         itemNameLower.includes('ny_bhdl') ||
                                         itemNameLower.includes('ny_ny') ||
                                         (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'));
                        const isShippingItem = itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping');
                        
                        return Math.abs(amount) > 0.01 && !isTaxItem && !isShippingItem;
                      });
                      
                      let productsTotal = 0;
                      let shippingTotal = 0;
                      
                      allItems.forEach(item => {
                        const qty = Math.abs(parseFloat(String(item.quantity || 0)));
                        const rate = Math.abs(parseFloat(String(item.rate || 0)));
                        const amount = parseFloat(String(item.amount || 0));
                        const itemNameLower = (item.itemName || '').toLowerCase();
                        
                        const itemTotal = qty > 0 ? qty * rate : Math.abs(amount);
                        
                        if (itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping')) {
                          shippingTotal += itemTotal;
                        } else if (
                          itemNameLower === 'customer discount' ||
                          itemNameLower.includes('% off') ||
                          itemNameLower.includes('% discount') ||
                          itemNameLower === 'discount' ||
                          itemNameLower.includes('we pay the tax') ||
                          itemNameLower.includes('we pay') ||
                          itemNameLower.includes('credit') ||
                          itemNameLower.includes('ny_') ||
                          (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'))
                        ) {
                        } else {
                          productsTotal += itemTotal;
                        }
                      });
                      
                      const discountTotal = Math.abs(parseFloat(estimate.discountTotal || '0'));
                      const subtotal = productsTotal;
                      
                      return (
                        <>
                          {displayItems.map((item, index) => {
                            const quantity = parseFloat(String(item.quantity || 0));
                            const rate = parseFloat(String(item.rate || 0));
                            const amount = parseFloat(String(item.amount || 0));
                            const itemNameLower = (item.itemName || '').toLowerCase();
                            
                            const displayQuantity = Math.abs(quantity);
                            const displayRate = Math.abs(rate);
                            
                            let displayAmount = displayQuantity > 0 
                              ? displayQuantity * displayRate 
                              : Math.abs(amount);
                            
                            let bgColor = "bg-gray-50";
                            let textColor = "text-gray-900";
                            let descColor = "text-gray-600";
                            let isNegative = false;
                            
                            if (itemNameLower === 'customer discount') {
                              bgColor = "bg-yellow-50";
                              textColor = "text-yellow-900";
                              descColor = "text-yellow-700";
                              isNegative = true;
                            } else if (itemNameLower.includes('credit') || itemNameLower.includes('we pay the tax') || itemNameLower.includes('we pay')) {
                              bgColor = "bg-green-50";
                              textColor = "text-green-900";
                              descColor = "text-green-700";
                              isNegative = true;
                            } else if (itemNameLower.includes('% off') || itemNameLower.includes('% discount') || itemNameLower === 'discount') {
                              bgColor = "bg-green-50";
                              textColor = "text-green-900";
                              descColor = "text-green-700";
                              isNegative = true;
                            }
                            
                            return (
                              <div key={`item-${item.id || index}`} className={`${bgColor} p-3 rounded-lg`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${textColor}`}>
                                      {item.itemName || item.name}
                                    </h4>
                                    {item.description && 
                                      !item.description.toLowerCase().includes('click print for description') && (
                                      <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4 w-24">
                                    <p className={`font-semibold ${textColor}`}>
                                      {isNegative ? '-' : ''}${displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    {displayQuantity > 0 && (
                                      <p className={`text-sm ${descColor}`}>
                                        {displayQuantity} × ${displayRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                            
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">SUBTOTAL</span>
                              <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            
                            {discountTotal > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">DISCOUNTS</span>
                                <span className="font-medium">-${discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            
                            {estimate.tax && parseFloat(estimate.tax) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">TAX</span>
                                <span className="font-medium">${parseFloat(estimate.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            
                            {shippingTotal > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">SHIPPING CHARGES</span>
                                <span className="font-medium">${shippingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            
                            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                              <span>TOTAL</span>
                              <span>${parseFloat(estimate.amount || estimate.totalAmount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {estimate.description && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Description
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-base">{estimate.description}</p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
