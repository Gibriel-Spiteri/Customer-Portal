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
  Plus,
  Loader2,
  X,
  Calendar,
  User,
  Tag
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
      open: <Clock className="h-4 w-4" />,
      in_progress: <AlertCircle className="h-4 w-4" />,
      resolved: <CheckCircle className="h-4 w-4" />,
      closed: <CheckCircle className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Phone className="h-8 w-8 mx-auto mb-4 netsuite-blue" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Phone Support</h3>
                      <p className="text-gray-600 mb-4">
                        Speak directly with our support team
                      </p>
                      <p className="font-medium text-netsuite-blue">1-800-NETSUITE</p>
                      <p className="text-sm text-gray-500">Mon-Fri, 8AM-6PM EST</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Mail className="h-8 w-8 mx-auto mb-4 netsuite-blue" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
                      <p className="text-gray-600 mb-4">
                        Send us an email for non-urgent issues
                      </p>
                      <p className="font-medium text-netsuite-blue">support@company.com</p>
                      <p className="text-sm text-gray-500">Response within 24 hours</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <MessageSquare className="h-8 w-8 mx-auto mb-4 netsuite-blue" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Chat</h3>
                      <p className="text-gray-600 mb-4">
                        Chat with our support agents
                      </p>
                      <Button variant="outline" className="mt-2">
                        Start Chat
                      </Button>
                      <p className="text-sm text-gray-500 mt-2">Available 24/7</p>
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
                  <div className="flex items-center justify-between">
                    <CardTitle>Your Support Cases from NetSuite</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      Synced from NetSuite
                    </Badge>
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
                  ) : tickets && tickets.length > 0 ? (
                    <div className="space-y-4">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {ticket.subject}
                            </h3>
                            <Badge className={getStatusColor(ticket.status)}>
                              {getStatusIcon(ticket.status)}
                              <span className="ml-1 capitalize">
                                {ticket.status.replace('_', ' ')}
                              </span>
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {ticket.description}
                          </p>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div>
                              {ticket.caseNumber && (
                                <span className="font-medium text-gray-700">Case #{ticket.caseNumber}</span>
                              )}
                              <span className={ticket.caseNumber ? "ml-3" : ""}>Created: {formatDate(ticket.createdAt)}</span>
                              {ticket.assignedTo && (
                                <span className="ml-4">Assigned to: {ticket.assignedTo}</span>
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
                  ) : (
                    <div className="text-center py-8">
                      <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Support Cases Found</h3>
                      <p className="text-gray-600 mb-4">
                        You don't have any open support cases in NetSuite.
                      </p>
                      <p className="text-sm text-gray-500">
                        To create a new support case, please contact our support team using the options above.
                      </p>
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
                      {selectedTicket?.caseNumber && (
                        <Badge variant="outline" className="text-sm">
                          Case #{selectedTicket.caseNumber}
                        </Badge>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  
                  {selectedTicket && (
                    <div className="space-y-6">
                      {/* Subject and Status */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          Subject: {selectedTicket.subject}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getStatusColor(selectedTicket.status)}>
                            {getStatusIcon(selectedTicket.status)}
                            <span className="ml-1 capitalize">
                              {selectedTicket.status.replace('_', ' ')}
                            </span>
                          </Badge>
                          {selectedTicket.category && (
                            <Badge variant="outline">
                              <Tag className="h-3 w-3 mr-1" />
                              {selectedTicket.category}
                            </Badge>
                          )}
                        </div>
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

                      {/* Description */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-gray-600 whitespace-pre-wrap">
                            {selectedTicket.description}
                          </p>
                        </div>
                      </div>

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
