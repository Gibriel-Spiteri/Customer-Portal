import { Link } from "wouter";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, CalendarCheck } from "lucide-react";

export default function ProjectQuote() {
  return (
    <MobileLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Get a Project Quote
          </h1>
          <p className="text-muted-foreground">
            Choose how you'd like to work with our team.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3 text-center">
            <Link href="/quick-quote/request">
              <Button size="lg" className="w-full" data-testid="button-quick-quote">
                <Zap className="mr-2 h-5 w-5" />
                Quick Quote
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Send your measurements, project details, and a wish list. We'll
              email you back a complete customer presentation, including retail
              pricing to show your client, and PRO pricing to protect your
              profit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-center">
            <Link href="/client-concierge">
              <Button size="lg" className="w-full" data-testid="button-client-concierge">
                <CalendarCheck className="mr-2 h-5 w-5" />
                Client Concierge
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Request a showroom appointment for your client. We'll guide
              their design and product selections, show only retail pricing,
              and email your profit-protected estimates.
            </p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
