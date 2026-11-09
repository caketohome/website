import { NextRequest } from "next/server";
import {
  GET as baseGET,
  POST as basePOST,
  PUT as basePUT,
  PATCH as basePATCH,
  DELETE as baseDELETE,
} from "../../[...path]/route";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  return baseGET(req, context);
}

export async function POST(req: NextRequest, context: { params: { path: string[] } }) {
  return basePOST(req, context);
}

export async function PUT(req: NextRequest, context: { params: { path: string[] } }) {
  return basePUT(req, context);
}

export async function PATCH(req: NextRequest, context: { params: { path: string[] } }) {
  return basePATCH(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { path: string[] } }) {
  return baseDELETE(req, context);
}
