import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import CanvasDraw from "react-canvas-draw";
import { CirclePicker } from "react-color";
import { useWindowSize } from "usehooks-ts";
import { useAccount } from "wagmi";
import { ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getGpt4oClassify } from "~~/app/classify";
import { Game, Player as playerType } from "~~/types/game/game";
import { updatePlayerStatus } from "~~/utils/doodleExchange/api/apiUtils";
import { uploadToFirebase } from "~~/utils/uploadToFirebase";

interface CanvasDrawLines extends CanvasDraw {
  canvas: any;
  props: {
    brushColor: string;
    canvasWidth: any;
    canvasHeight: any;
  };
}

const Player = ({
  game,
  moveToNextRound,
  finishGame,
  player,
  isUpdatingRound,
  countdown,
  token,
}: {
  game: Game;
  moveToNextRound: (winner: string, won: boolean) => void;
  finishGame: () => void;
  player: playerType;
  isUpdatingRound: boolean;
  countdown: number;
  token: string;
}) => {
  const { address: connectedAddress } = useAccount();
  const drawingCanvas = useRef<CanvasDrawLines>(null);
  const [color, setColor] = useState<string>("rgba(96,125,139,100)");
  const [canvasDisabled, setCanvasDisabled] = useState<boolean>(false);
  const [finalDrawing, setFinalDrawing] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [gptAnswer, setGPTAnswer] = useState<string>("");
  const [drawingStarted, setDrawingStarted] = useState(false);

  const { width = 1, height = 1 } = useWindowSize({ initializeWithValue: false, debounceDelay: 500 });
  const calculatedCanvaSize = Math.round(0.8 * Math.min(width, height));
  const colorPickerSize = `${Math.round(0.95 * calculatedCanvaSize)}px`;

  useEffect(() => {
    if (calculatedCanvaSize !== 1) {
      setLoading(false);
    }
  }, [calculatedCanvaSize]);

  const updateColor = (value: any) => {
    const { r, g, b, a } = value.rgb;
    setColor(`rgba(${r},${g},${b},${a})`);
  };

  const handleSubmit = async () => {
    updatePlayerStatus(game._id, "classifying", token, connectedAddress || "");
    setCanvasDisabled(true);
    const drawingDataUrl = drawingCanvas.current?.canvas.drawing.toDataURL() || "";
    setFinalDrawing(drawingDataUrl);
    console.log(drawingDataUrl);
    const response = await getGpt4oClassify(drawingDataUrl);
    if (response?.answer) {
      uploadToFirebase(game.wordsList?.[player.currentRound], response.answer, connectedAddress || "", drawingDataUrl);
      setGPTAnswer(response.answer);
      if (response.answer.toLowerCase() === game.wordsList?.[player.currentRound]?.toLowerCase()) {
        moveToNextRound(connectedAddress || "", true);
        resetGame();
      }
    } else {
      console.log("error with classification fetching part");
    }
    updatePlayerStatus(game._id, "waiting", token, connectedAddress || "");
    setDrawingStarted(false);
  };

  const resetGame = async () => {
    setGPTAnswer("");
    if (game.currentRound === game.totalRounds) {
      await finishGame();
    }
    setCanvasDisabled(false);
    setFinalDrawing("");
  };

  if (loading) {
    return <span className="flex flex-col m-auto loading loading-spinner loading-sm"></span>;
  }

  return (
    <div className="flex items-center flex-col flex-grow pt-3">
      {finalDrawing ? (
        <>
          <div className="mb-1.5 text-center">
            {gptAnswer ? (
              <div className="flex flex-col items-center">
                <button className="btn btn-sm btn-primary mb-1" onClick={resetGame}>
                  {game.currentRound === game.totalRounds
                    ? "Show Results"
                    : gptAnswer.toLowerCase() === game.wordsList?.[player.currentRound]?.toLowerCase()
                      ? "Next Round"
                      : "Try again"}
                </button>
                <div>
                  GPT sees <span className="font-bold">{gptAnswer}</span>
                </div>
              </div>
            ) : (
              <span className="flex flex-col m-auto loading loading-spinner loading-sm"></span>
            )}
          </div>
          <div className="border-2 bg-white">
            <Image width={calculatedCanvaSize} height={calculatedCanvaSize} src={finalDrawing} alt="Your drawing" />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-2">
            <div className="m-auto">
              <span className="text-3xl">{game.wordsList?.[game.currentRound]}</span>
            </div>
            <div>
              <button className="btn btn-sm btn-secondary" onClick={() => drawingCanvas.current?.undo()}>
                <ArrowUturnLeftIcon className="h-4 w-4" /> UNDO
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => drawingCanvas.current?.clear()}>
                <TrashIcon className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>
          <div className="h-6">{isUpdatingRound ? `Moving to next round in ${countdown} Seconds` : ""}</div>
          <div className={canvasDisabled ? "cursor-not-allowed" : "cursor-none"}>
            <CanvasDraw
              key="canvas"
              ref={drawingCanvas}
              canvasWidth={calculatedCanvaSize}
              canvasHeight={calculatedCanvaSize}
              brushColor={color}
              lazyRadius={1}
              brushRadius={3}
              disabled={canvasDisabled}
              hideGrid
              immediateLoading
              loadTimeOffset={10}
              onChange={() => {
                if (drawingStarted) {
                  return;
                }
                updatePlayerStatus(game._id, "drawing", token, connectedAddress || "");
                setDrawingStarted(true);
              }}
            />
          </div>
          <div className="flex flex-col mt-2">
            <CirclePicker
              color={color}
              onChangeComplete={updateColor}
              circleSpacing={4}
              width={colorPickerSize}
              className="max-w-xl"
            />
            <div className="flex flex-col justify-center mt-2">
              <button
                className="btn btn-block btn-primary"
                onClick={handleSubmit}
                disabled={game.currentRound !== player.currentRound}
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Player;
