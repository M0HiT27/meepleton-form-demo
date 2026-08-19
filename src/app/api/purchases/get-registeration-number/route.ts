import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function GET() {
  try{
    const passes = await prisma.pass.findMany({
    select: {
        num_people: true,
        _count: {
        select: {
            purchases: {
            where: {
                status: 'CONFIRMED',
            },
            },
        },
        },
    },
    });

    // Multiply confirmed purchases * num_people for each pass, and sum them up
    const totalRegisteredPeople = passes.reduce((total, pass) => {
        return total + (pass.num_people * pass._count.purchases);
    }, 0);

    console.log(`Total people registered: ${totalRegisteredPeople}`);
    return NextResponse.json({ success: true, data: {count : totalRegisteredPeople} }, { status: 200 });
  }catch(e){
    console.error(e);
    return NextResponse.json({ success: false, data: null }, { status: 500 });
  }
}