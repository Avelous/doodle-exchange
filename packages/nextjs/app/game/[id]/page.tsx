"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Host from "../_components/Host";
import Lobby from "../_components/Lobby";
import Player from "../_components/Player";
import Results from "../_components/Results";
import Ably from "ably";
import { useAccount } from "wagmi";
import doodleConfig from "~~/doodle.config";
import useGameData from "~~/hooks/doodleExchange/useGameData";
import { Game, Player as playerType } from "~~/types/game/game";
import { joinGame, updateGameRound, updateGameStatus, updatePlayerRound } from "~~/utils/doodleExchange/api/apiUtils";
import { notification } from "~~/utils/scaffold-eth";

const GamePage = () => {
  const ablyApiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY || doodleConfig.ably_api_key;
  const { id } = useParams();
  const { loadGameState, updateGameState, updatePlayerState } = useGameData();
  const { address: connectedAddress } = useAccount();

  const [isHost, setIsHost] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [game, setGame] = useState<Game>();
  const [player, setPlayer] = useState<playerType>();
  const [token, setToken] = useState("");

  const [isUpdatingRound, setIsUpdatingRound] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const loadGame = async () => {
      const game = loadGameState();
      if (game && game.game && game.game.inviteCode === id) {
        const { token, game: gameState } = game;
        if (connectedAddress === gameState.hostAddress) setIsHost(true);
        if (gameState.players.some((player: playerType) => player.address === connectedAddress)) {
          const player = gameState.players.find((player: playerType) => player.address === connectedAddress);
          setPlayer(player);
          setIsPlayer(true);
        }
        setGame(gameState);
        setToken(token);
        // if (game.player) setPlayer(game.player);
      } else {
        if (connectedAddress) {
          await joinGame(id as string, connectedAddress);
          setIsPlayer(true);
        }
      }
    };

    loadGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, id]);

  useEffect(() => {
    if (!game && isPlayer) {
      const game = loadGameState();
      if (game && game.game) {
        const { token, game: gameState } = game;
        setGame(gameState);
        setToken(token);
        const player = gameState.players.find((player: playerType) => player.address === connectedAddress);
        setPlayer(player);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayer]);

  useEffect(() => {
    if (!ablyApiKey) return;

    const ably = new Ably.Realtime({ key: ablyApiKey });
    const gameChannel = ably.channels.get(`gameUpdate`);

    gameChannel.subscribe(message => {
      if (game?._id === message.data._id) {
        setGame(message.data);
        const player = message.data.players.find((player: playerType) => player.address === connectedAddress);
        setPlayer(player);
        updateGameState(JSON.stringify(message.data));
      }
    });

    const playerChannel = ably.channels.get(`playerUpdate`);

    playerChannel.subscribe(message => {
      if (player?._id === message.data._id) {
        // setPlayer(message.data);
        updatePlayerState(JSON.stringify(message.data));
      }
    });

    const updateRoundChannel = ably.channels.get(`updateRound`);

    updateRoundChannel.subscribe(message => {
      if (game?._id === message.data._id) {
        setIsUpdatingRound(true);
        notification.info(`Moving to the next round`, { duration: 3000 });

        const interval = setInterval(() => {
          setCountdown(oldCount => (oldCount <= 1 ? 0 : oldCount - 1));
        }, 1000);

        setTimeout(() => {
          if (isHost && game) {
            updateGameRound(game._id, game.currentRound + 1, token);
          }
          setIsUpdatingRound(false);
          setCountdown(60);
          clearInterval(interval);
        }, 60000);
      }
    });

    return () => {
      gameChannel.unsubscribe(`gameUpdate`);
      playerChannel.unsubscribe(`playerUpdate`);
      updateRoundChannel.unsubscribe(`updateRound`);
      ably.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, ablyApiKey]);

  const moveToNextRound = async (address: string, won: boolean) => {
    if (game) await updatePlayerRound(game._id, (player as playerType)?.currentRound + 1, token, address, won);
  };

  const finishGame = async () => {
    if (game) await updateGameStatus(game._id, "finished", token);
  };

  if (game?.status === "finished") {
    return <Results game={game as Game} />;
  } else if (isHost && game) {
    return <Host game={game as Game} token={token} isUpdatingRound={isUpdatingRound} countdown={countdown} />;
  } else if (isPlayer && game && game?.status === "lobby") {
    return <Lobby game={game as Game} />;
  } else if (isPlayer && game) {
    return (
      <Player
        game={game as Game}
        moveToNextRound={moveToNextRound}
        finishGame={finishGame}
        player={player as playerType}
        isUpdatingRound={isUpdatingRound}
        countdown={countdown}
        token={token}
      />
    );
  } else {
    return (
      <div className="p-4">
        <h1>Loading...</h1>
      </div>
    );
  }
};

export default GamePage;
