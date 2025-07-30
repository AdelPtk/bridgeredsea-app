import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import ParticipantCard from "@/components/ParticipantCard";
import EventsList from "@/components/EventsList";

const ParticipantPage = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const [participant, setParticipant] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/DATA.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const found = results.data.find((row: any) => {
              return row.id === id || row.ID === id || row["מזהה"] === id;
            });
            setParticipant(found || null);
            setLoading(false);
          },
        });
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-center py-12">טוען נתונים...</div>;
  }
  if (!participant) {
    return <div className="text-center py-12 text-red-600">משתתף לא נמצא</div>;
  }

  return (
  
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* תמונת לוגו בראש העמוד */}
        <div className="flex justify-center mb-6">
          <img src="/RedSea-MainText-HEB.svg" alt="RedSea Bridge Festival" className="max-h-24 w-auto" />
        </div>
        <ParticipantCard participant={participant} />
        <EventsList participant={participant} />
      </div>
    </div>
  );
};

export default ParticipantPage;