import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 max-w-[500px] mx-auto">
      <div className="w-12 h-12 rounded-full border-2 border-[#8C2F39] text-[#8C2F39] flex items-center justify-center font-serif text-2xl font-bold">
        §
      </div>
      <h1 className="font-serif text-3xl font-bold text-[#26231B]">
        Entry Not Found in Docket
      </h1>
      <p className="text-[14px] text-[#5D574A] leading-relaxed">
        The requested deed, record, or page could not be located in the custody register.
      </p>
      <div className="pt-2">
        <Link href="/">
          <Button variant="primary" size="md">
            Return to Docket Book
          </Button>
        </Link>
      </div>
    </div>
  );
}
