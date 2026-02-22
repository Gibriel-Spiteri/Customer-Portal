import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  HelpCircle, 
  Phone, 
  Mail, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
  Plus,
  Loader2,
  X,
  Calendar,
  User,
  Tag,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  detail?: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  caseNumber?: string;
  category?: string;
  followUpDate?: string | null;
  relatedSalesOrder?: string | null;
  messages?: CaseMessage[];
}

interface CaseMessage {
  id: string;
  subject: string;
  content: string;
  author: string;
  date: string;
  type: 'system' | 'user';
}

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
});

type TicketFormData = z.infer<typeof ticketSchema>;

export default function Support() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [caseMessages, setCaseMessages] = useState<CaseMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: tickets, isLoading, error } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets'],
    enabled: !!token,
  });

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      description: "",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create ticket');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Support Ticket Created",
        description: "Your support ticket has been submitted successfully. We'll get back to you soon.",
      });
      form.reset();
      setShowNewTicketForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      '1': <Clock className="h-4 w-4" />,           // Not Started
      '2': <AlertCircle className="h-4 w-4" />,     // In Progress
      '3': <AlertTriangle className="h-4 w-4" />,   // Escalated
      '4': <RefreshCw className="h-4 w-4" />,      // Re-Opened
      '5': <CheckCircle className="h-4 w-4" />,     // Closed
      '6': <PauseCircle className="h-4 w-4" />,    // On Hold
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      '1': 'bg-yellow-100 text-yellow-800',    // Not Started
      '2': 'bg-blue-100 text-blue-800',        // In Progress
      '3': 'bg-red-100 text-red-800',          // Escalated
      '4': 'bg-orange-100 text-orange-800',    // Re-Opened
      '5': 'bg-gray-100 text-gray-800',        // Closed
      '6': 'bg-purple-100 text-purple-800',    // On Hold
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Map status codes to names
  const statusNames: Record<string, string> = {
    '1': 'Not Started',
    '2': 'In Progress',
    '3': 'Escalated',
    '4': 'Re-Opened',
    '5': 'Closed',
    '6': 'On Hold (COR-CHECK PO)'
  };

  // Get unique statuses from tickets
  const getUniqueStatuses = () => {
    if (!tickets) return [];
    const statuses = new Set(tickets.map(ticket => ticket.status));
    return Array.from(statuses).sort();
  };

  // Filter tickets based on selected status
  const filteredTickets = tickets?.filter(ticket => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') {
      // Show open cases: Not Started (1), In Progress (2), Escalated (3), Re-Opened (4)
      return ['1', '2', '3', '4'].includes(ticket.status);
    }
    return ticket.status === statusFilter || ticket.status === Number(statusFilter).toString();
  }) || [];

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Paginate the filtered tickets
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  if (!user) {
    return <div>Please log in to access support</div>;
  }

  return (
    <MobileLayout>
              {/* Header Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
                    <p className="mt-1 text-gray-600">
                      Get help with your account, orders, and technical issues.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowNewTicketForm(!showNewTicketForm)}
                    className="bg-netsuite-blue hover:bg-netsuite-light"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <Phone className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Phone</h3>
                        <p className="text-sm font-medium text-blue-600">631-563-3200</p>
                        <p className="text-xs text-gray-500">Mon-Fri, 9AM-5PM EST</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Email</h3>
                        <p className="text-sm font-medium text-blue-600">support@ckbmail.com</p>
                        <p className="text-xs text-gray-500">Response within 48 hours</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Live Chat</h3>
                        <p className="text-sm font-medium text-blue-600">Start Chat</p>
                        <p className="text-xs text-gray-500">Available 24/7</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* New Ticket Form */}
              {showNewTicketForm && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Create New Support Ticket</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          placeholder="Brief description of your issue"
                          {...form.register("subject")}
                        />
                        {form.formState.errors.subject && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.subject.message}
                          </p>
                        )}
                      </div>



                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Please provide detailed information about your issue, including any error messages or steps to reproduce the problem."
                          rows={6}
                          {...form.register("description")}
                        />
                        {form.formState.errors.description && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.description.message}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowNewTicketForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createTicketMutation.isPending}
                          className="bg-netsuite-blue hover:bg-netsuite-light"
                        >
                          {createTicketMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create Ticket'
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Support Tickets */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <CardTitle>Your Support Cases from NetSuite</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        Synced from NetSuite
                      </Badge>
                    </div>
                    
                    {/* Status Filter */}
                    {tickets && tickets.length > 0 && (
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-600">Filter by status:</span>
                        <Select
                          value={statusFilter}
                          onValueChange={setStatusFilter}
                        >
                          <SelectTrigger className="w-[200px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">
                              All Open Cases ({tickets.filter(t => ['1', '2', '3', '4'].includes(t.status)).length})
                            </SelectItem>
                            <SelectItem value="all">
                              All Cases ({tickets.length})
                            </SelectItem>
                            <SelectItem value="1">
                              Not Started ({tickets.filter(t => t.status === '1').length})
                            </SelectItem>
                            <SelectItem value="2">
                              In Progress ({tickets.filter(t => t.status === '2').length})
                            </SelectItem>
                            <SelectItem value="3">
                              Escalated ({tickets.filter(t => t.status === '3').length})
                            </SelectItem>
                            <SelectItem value="4">
                              Re-Opened ({tickets.filter(t => t.status === '4').length})
                            </SelectItem>
                            <SelectItem value="5">
                              Closed ({tickets.filter(t => t.status === '5').length})
                            </SelectItem>
                            <SelectItem value="6">
                              On Hold ({tickets.filter(t => t.status === '6').length})
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {statusFilter !== 'open' && statusFilter !== 'all' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusFilter('open')}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Skeleton className="h-5 w-48" />
                            <div className="flex space-x-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Tickets</h3>
                      <p className="text-gray-600">Please try refreshing the page.</p>
                    </div>
                  ) : filteredTickets && filteredTickets.length > 0 ? (
                    <>
                      <div className="space-y-4">
                        {paginatedTickets.map((ticket) => (
                          <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {ticket.subject}
                            </h3>
                            <Badge className={getStatusColor(ticket.status)}>
                              {getStatusIcon(ticket.status)}
                              <span className="ml-1">
                                {statusNames[ticket.status] || ticket.status}
                              </span>
                            </Badge>
                          </div>

                          {ticket.detail && (
                            <div className="bg-gray-50 rounded p-3 mb-3">
                              <p className="text-base text-gray-700 line-clamp-2">
                                <span className="font-semibold">Detail: </span>
                                {ticket.detail}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div>
                              {ticket.caseNumber && (
                                <span className="font-medium text-gray-700">Case #{ticket.caseNumber}</span>
                              )}
                              <span className={ticket.caseNumber ? "ml-3" : ""}>Created: {formatDate(ticket.createdAt)}</span>
                              {ticket.assignedTo && (
                                <span className="ml-4">Assigned to: {ticket.assignedTo}</span>
                              )}
                              {ticket.followUpDate && (
                                <span className="ml-4">
                                  <Calendar className="inline h-3 w-3 mr-1" />
                                  Follow up: {formatDate(ticket.followUpDate)}
                                </span>
                              )}
                              {ticket.relatedSalesOrder && (
                                <span className="ml-4">
                                  <Tag className="inline h-3 w-3 mr-1" />
                                  SO: {ticket.relatedSalesOrder}
                                </span>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                setSelectedTicket(ticket);
                                setLoadingMessages(true);
                                setCaseMessages([]);
                                
                                // Fetch messages for this case
                                try {
                                  const response = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                    },
                                  });
                                  
                                  if (response.ok) {
                                    const messages = await response.json();
                                    setCaseMessages(messages);
                                  }
                                } catch (error) {
                                  console.error('Failed to fetch case messages:', error);
                                } finally {
                                  setLoadingMessages(false);
                                }
                              }}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="text-sm text-gray-500">
                          Showing {startIndex + 1} to {Math.min(endIndex, filteredTickets.length)} of {filteredTickets.length} cases
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          
                          {/* Page numbers */}
                          <div className="flex space-x-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      {tickets && tickets.length > 0 && filteredTickets.length === 0 ? (
                        <>
                          <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Cases Found</h3>
                          <p className="text-gray-600">No support cases match the selected status filter.</p>
                          <Button
                            onClick={() => setStatusFilter('all')}
                            variant="outline"
                            className="mt-4"
                          >
                            Clear Filter
                          </Button>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Support Cases Found</h3>
                          <p className="text-gray-600 mb-4">
                            You don't have any open support cases in NetSuite.
                          </p>
                          <p className="text-sm text-gray-500">
                            To create a new support case, please contact our support team using the options above.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* FAQ Section */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        How often is my data synchronized with NetSuite?
                      </h3>
                      <p className="text-gray-600">
                        Critical data like orders, payments, and account balances are synchronized in real-time. 
                        Historical data and customer details are updated every 10 minutes using batch synchronization.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        Why do I see "LIVE" and "CACHED" badges on data?
                      </h3>
                      <p className="text-gray-600">
                        These badges indicate data freshness. "LIVE" means the data is synchronized in real-time, 
                        while "CACHED" means the data is updated at regular intervals to optimize performance and reduce API usage.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        What should I do if I notice data discrepancies?
                      </h3>
                      <p className="text-gray-600">
                        If you notice any discrepancies between the portal and NetSuite, try refreshing the data using the refresh button. 
                        If the issue persists, please create a support ticket with specific details about the discrepancy.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        How can I download my invoices?
                      </h3>
                      <p className="text-gray-600">
                        You can download individual invoices from the invoice details page, or use the bulk download feature 
                        from the main invoices page to download multiple invoices at once.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ticket Details Modal */}
              <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span>Case Details</span>
                      <div className="flex items-center gap-2">
                        {selectedTicket && (
                          <Badge className={getStatusColor(selectedTicket.status)}>
                            {getStatusIcon(selectedTicket.status)}
                            <span className="ml-1 capitalize">
                              {selectedTicket.status.replace('_', ' ')}
                            </span>
                          </Badge>
                        )}
                        {selectedTicket?.caseNumber && (
                          <Badge variant="outline" className="text-sm">
                            Case #{selectedTicket.caseNumber}
                          </Badge>
                        )}
                      </div>
                    </DialogTitle>
                  </DialogHeader>
                  
                  {selectedTicket && (
                    <div className="space-y-6">
                      {/* Subject and Category */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          Subject: {selectedTicket.subject}
                        </h3>
                        {selectedTicket.category && (
                          <Badge variant="outline">
                            <Tag className="h-3 w-3 mr-1" />
                            {selectedTicket.category}
                          </Badge>
                        )}
                      </div>

                      {/* Detail */}
                      {selectedTicket.detail && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Detail</h4>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-600 whitespace-pre-wrap">
                              {selectedTicket.detail}
                            </p>
                          </div>
                        </div>
                      )}



                      {/* Metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <span className="font-medium">Created:</span>
                            <span className="ml-2">{formatDate(selectedTicket.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <span className="font-medium">Last Updated:</span>
                            <span className="ml-2">{formatDate(selectedTicket.updatedAt)}</span>
                          </div>
                        </div>

                        {selectedTicket.assignedTo && (
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="h-4 w-4 mr-2 text-gray-400" />
                            <div>
                              <span className="font-medium">Assigned To:</span>
                              <span className="ml-2">{selectedTicket.assignedTo}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Messages Section */}
                      {(caseMessages.length > 0 || loadingMessages) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Case Messages</h4>
                          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                            {loadingMessages ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                <span className="ml-2 text-sm text-gray-500">Loading messages...</span>
                              </div>
                            ) : caseMessages.length > 0 ? (
                              caseMessages.map((message) => (
                                <div key={message.id} className="bg-white rounded-lg p-3 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                      <MessageSquare className="h-4 w-4 mr-2 text-gray-400" />
                                      <span className="text-sm font-medium text-gray-700">
                                        {message.subject}
                                      </span>
                                    </div>
                                    <Badge variant={message.type === 'system' ? 'outline' : 'default'} className="text-xs">
                                      {message.type === 'system' ? 'System' : 'User'}
                                    </Badge>
                                  </div>
                                  <div 
                                    className="text-sm text-gray-600 mb-2"
                                    dangerouslySetInnerHTML={{ 
                                      __html: message.content.replace(/<[^>]*>/g, '').substring(0, 200) + 
                                              (message.content.length > 200 ? '...' : '')
                                    }}
                                  />
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>From: {message.author}</span>
                                    <span>{new Date(message.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-2">
                                No messages found for this case
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-sm text-gray-500">
                          For updates on this case, please contact our support team.
                        </div>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedTicket(null);
                            setCaseMessages([]);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
    </MobileLayout>
  );
}
