package main

import (
	"fmt"
	"log"
	"os"
  "runtime/debug"

	. "github.com/3d0c/gmf"
  . "github.com/lumas/lumas-core/processor"
)

func fatal(err error) {
	debug.PrintStack()
	log.Fatal(err)
}

func assert(i interface{}, err error) interface{} {
	if err != nil {
		fatal(err)
	}

	return i
}

func addStreams(inputCtx *FmtCtx, outputCtx *FmtCtx) {
	for i := 0; i < inputCtx.StreamsCnt(); i++ {
		srcStream, err := inputCtx.GetStream(i)
		if err != nil {
			fmt.Println("GetStream error")
		}

		outputCtx.AddStreamWithCodeCtx(srcStream.CodecCtx())
	}
}

func main() {
  var srcFileName, dstFileName string

	log.SetFlags(log.Lshortfile | log.Ldate | log.Ltime)

	if len(os.Args) != 3 {
		fmt.Println("usage:", os.Args[0], " input output")
		fmt.Println("API example program to remux a media file with libavformat and libavcodec.")
		fmt.Println("The output format is guessed according to the file extension.")

		os.Exit(0)
	} else {
		srcFileName = os.Args[1]
		dstFileName = os.Args[2]
	}

	inputCtx := assert(NewInputCtx(srcFileName)).(*FmtCtx)
	defer inputCtx.CloseInputAndRelease()
	inputCtx.Dump()

	outputCtx := assert(NewOutputCtxWithFormatName(dstFileName, "mpegts")).(*FmtCtx)
	defer outputCtx.CloseOutputAndRelease()
  outputCtx.SetStartTime(0)
  addStreams(inputCtx, outputCtx)
	outputCtx.Dump()

	srcVideoStream, err := inputCtx.GetBestStream(AVMEDIA_TYPE_VIDEO)
	if err != nil {
		log.Println("No video stream found in", srcFileName)
	}

  motions := make(chan *Motion, 100)
  defer close(motions)
  frames  := make(chan *Frame, 100)
  defer close(frames)
  packets := make(chan *Packet, 100)
  defer close(packets)

  //Write the packets to disk concurrently
  go WriteFile(packets, outputCtx)

  go DetectMotion(frames, motions, srcVideoStream.CodecCtx(), srcVideoStream.TimeBase().AVR())

  go func() {
    for motion := range motions {
      if motion.MotionDetected {
        fmt.Println("found motion in frame ")
        fmt.Println(motion.FramePktPts)
      } else {
        fmt.Println("no motion")
      }
    }
  }()

	for packet := range inputCtx.GetNewPackets() {
    packets <- packet

    if packet.StreamIndex() != srcVideoStream.Index() {
      //It's an audio packet
      continue
    }

		ist := assert(inputCtx.GetStream(packet.StreamIndex())).(*Stream)

    frame, err := packet.Frames(ist.CodecCtx())
    if err != nil {
      //fmt.Println("error: " + err.Error())
      continue
    }

    fcopy := frame.CloneNewFrame()
    frame.Free()
    frames <- fcopy
  }
}
