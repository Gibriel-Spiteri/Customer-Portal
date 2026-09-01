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
          <CardContent className="pt-6 space-y-4">
            <Link href="/quick-quote/request">
              <Button size="lg" className="w-full" data-testid="button-quick-quote">
                <Zap className="mr-2 h-5 w-5" />
                Quick Quote
              </Button>
            </Link>
            <ul className="space-y-2 text-sm text-muted-foreground text-left">
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Send measurements, project details, and your wish list.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Receive a customer presentation by email.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Includes retail pricing for your client and PRO pricing to protect your profit.</span></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Link href="/client-concierge">
              <Button size="lg" className="w-full" data-testid="button-client-concierge">
                <CalendarCheck className="mr-2 h-5 w-5" />
                Client Concierge
              </Button>
            </Link>
            <ul className="space-y-2 text-sm text-muted-foreground text-left">
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Request a showroom appointment for your client.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>We'll guide their design and product selections.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Your client sees retail pricing only.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>We'll email your profit-protected estimates.</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
