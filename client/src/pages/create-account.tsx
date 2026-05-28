import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ShieldCheck, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  Users,
  CheckCircle,
  ArrowRight,
  Package,
  Receipt
} from 'lucide-react';

export default function CreateAccount() {
  const benefits = [
    {
      icon: FileText,
      title: "Access Your Orders",
      description: "View your complete order history, track shipments, and download invoices anytime."
    },
    {
      icon: CreditCard,
      title: "Manage Payments",
      description: "Review payment history, check account balance, and view credit limits in one place."
    },
    {
      icon: TrendingUp,
      title: "Track Estimates",
      description: "Access quotes and estimates, monitor their status, and convert them to orders easily."
    },
    {
      icon: Package,
      title: "Real-Time Updates",
      description: "Get instant updates on order status, shipment tracking, and delivery confirmations."
    },
    {
      icon: Receipt,
      title: "Invoice Management",
      description: "Download invoices, view payment status, and access tax documents for accounting."
    },
    {
      icon: Clock,
      title: "Save Time",
      description: "No more phone calls or emails - manage everything online 24/7 at your convenience."
    },
    {
      icon: Users,
      title: "Support Access",
      description: "Submit support tickets, track their progress, and communicate directly with our team."
    },
    {
      icon: ShieldCheck,
      title: "Secure & Private",
      description: "Your data is protected with enterprise-grade security and encrypted connections."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Create Your Customer Account
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get instant access to your orders, invoices, and account information. 
            Manage your business relationship with us online, anytime.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {benefits.map((benefit, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>



        {/* CTA Section */}
        <div className="text-center bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="text-gray-600 mb-6">
            Join thousands of customers who manage their accounts online.
            Registration takes less than 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Register Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Already Have an Account? Sign In
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            You'll need your Customer ID to register. 
            Contact us if you don't have one yet.
          </p>
        </div>
      </div>
      {/* Footer */}
      <div className="bg-gray-50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2026 PRO Portal. All rights reserved.</p>
            <p className="mt-2">
              Questions? Contact our support team for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}