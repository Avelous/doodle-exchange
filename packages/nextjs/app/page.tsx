"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getGpt4oClassify } from "./classify";
import type { NextPage } from "next";
import CanvasDraw from "react-canvas-draw";
import { CirclePicker } from "react-color";
import { useWindowSize } from "usehooks-ts";
import { ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/24/outline";

interface CanvasDrawLines extends CanvasDraw {
  canvas: any;
  props: {
    brushColor: string;
    canvasWidth: any;
    canvasHeight: any;
  };
}

const Home: NextPage = () => {
  const drawingCanvas = useRef<CanvasDrawLines>(null);
  const [color, setColor] = useState<string>("rgba(96,125,139,100)");
  const [canvasDisabled, setCanvasDisabled] = useState<boolean>(false);
  const [finalDrawing, setFinalDrawing] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [gptAnswer, setGPTAnswer] = useState<string>("");

  const { width = 1, height = 1 } = useWindowSize({ initializeWithValue: false, debounceDelay: 500 });
  const calculatedCanvaSize = Math.round(0.8 * Math.min(width, height));
  const colorPickerSize = Math.round(0.84 * calculatedCanvaSize).toString() + "px";

  useEffect(() => {
    if (calculatedCanvaSize !== 1) {
      setLoading(false);
    }
  }, [calculatedCanvaSize]);

  const updateColor = (value: any) => {
    setColor(`rgba(${value.rgb.r},${value.rgb.g},${value.rgb.b},${value.rgb.a})`);
  };

  if (loading) {
    return <span className="flex flex-col m-auto loading loading-spinner loading-sm"></span>;
  }

  const handleSubmit = async () => {
    setLoading(true);
    setCanvasDisabled(true);
    console.log(drawingCanvas?.current?.canvas.drawing.toDataURL());
    setFinalDrawing(drawingCanvas?.current?.canvas.drawing.toDataURL());
    const response = await getGpt4oClassify(drawingCanvas?.current?.canvas.drawing.toDataURL());
    if (response?.answer) {
      setGPTAnswer(response?.answer);
    } else {
      console.log("error with classification fetching part");
    }
    setLoading(false);
  };

  return (
    <>
      {finalDrawing ? (
        <div className="flex items-center flex-col flex-grow pt-10">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              setFinalDrawing("");
              setCanvasDisabled(false);
            }}
          >
            Start a new drawing
          </button>
          <h2 className="mt-2 text-center">
            {gptAnswer ? (
              <>
                GPT sees <span className="font-bold">{gptAnswer}</span>
              </>
            ) : (
              ""
            )}
          </h2>

          <div className="border-2 bg-white">
            <Image
              width={calculatedCanvaSize}
              height={calculatedCanvaSize}
              src={`${finalDrawing}`}
              alt="Your drawing"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center flex-col flex-grow pt-5">
          <div className="flex flex-row gap-2 mb-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                drawingCanvas.current?.undo();
              }}
            >
              <ArrowUturnLeftIcon className="h-4 w-4" /> UNDO
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                drawingCanvas?.current?.clear();
              }}
            >
              <TrashIcon className="h-4 w-4" /> Clear
            </button>
          </div>
          <div className={`${canvasDisabled ? "cursor-not-allowed" : "cursor-none"}`}>
            <CanvasDraw
              key={"canvas"}
              ref={drawingCanvas}
              canvasWidth={calculatedCanvaSize}
              canvasHeight={calculatedCanvaSize}
              brushColor={color}
              lazyRadius={1}
              brushRadius={3}
              disabled={canvasDisabled}
              hideGrid={true}
              immediateLoading={true}
              loadTimeOffset={10}
            />
          </div>

          <div className="flex flex-col mt-2">
            <CirclePicker color={color} onChangeComplete={updateColor} circleSpacing={4} width={colorPickerSize} />
            <div className="flex justify-center mt-2">
              <button className="btn btn-block btn-primary" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
