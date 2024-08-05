import { NextResponse } from "next/server";
import Game from "~~/lib/models/Game";
import { ablyRealtime } from "~~/lib/socket";

export const PATCH = async (request: Request) => {
  try {
    const body = await request.json();
    const { id, newRound } = body;
    const game = await Game.findById(id);

    if (!game) {
      return new NextResponse(JSON.stringify({ error: "Game not found " }), { status: 403 });
    }

    if (game.status == "finished") {
      return new NextResponse(JSON.stringify({ error: "Game has finished " }), { status: 403 });
    }

    game.currentRound = newRound;
    const updatedGame = await game.save();

    const channel = ablyRealtime.channels.get(`gameUpdate`);
    channel.publish(`gameUpdate`, updatedGame);
    return new NextResponse(
      JSON.stringify({ message: `Updated current game routn to ${newRound}`, game: updatedGame }),
      {
        status: 200,
      },
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: "Error updating Game Status " + (error as Error).message,
      }),
      {
        status: 500,
      },
    );
  }
};
