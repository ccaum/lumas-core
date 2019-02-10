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

	for i := 0; i < inputCtx.StreamsCnt(); i++ {
		srcStream, err := inputCtx.GetStream(i)
		if err != nil {
			fmt.Println("GetStream error")
		}

		outputCtx.AddStreamWithCodeCtx(srcStream.CodecCtx())
	}
	outputCtx.Dump()

	if err := outputCtx.WriteHeader(); err != nil {
		fatal(err)
	}

	srcVideoStream, err := inputCtx.GetBestStream(AVMEDIA_TYPE_VIDEO)
	if err != nil {
		log.Println("No video stream found in", srcFileName)
	}

  motionChan  := make(chan *Motion)
  motionFrame := make(chan *Frame, 2)

  go DetectMotion(motionFrame, motionChan, srcVideoStream.CodecCtx(), srcVideoStream.TimeBase().AVR())

  go func() {
    for motion := range motionChan {
      if motion.MotionDetected {
        fmt.Println("Found some motion")
      }

      //Now that we've processed the motion, we can free the frames from memory
      //motion.Frame.Free()
    }
  }()

  //i := 0
	for packet := range inputCtx.GetNewPackets() {
    //if i == 1000 {
    //  fmt.Println("breaking")
    //  break
    //}
    //i++

    if packet.StreamIndex() == srcVideoStream.Index() {

		  ist := assert(inputCtx.GetStream(packet.StreamIndex())).(*Stream)

      frame, err := packet.Frames(ist.CodecCtx())
      if err != nil {
        fmt.Println("error :(")
        // Retry if EAGAIN
        if err.Error() == "Resource temporarily unavailable" {
          continue
        }
        log.Fatal(err)
      }

      motionFrame <- frame
    }

    //Write the packet to a file
	  if err := outputCtx.WritePacket(packet); err != nil {
	    fatal(err)
	  }

	  packet.Free()
  }

  outputCtx.Free()
  close(motionChan)
  close(motionFrame)

  //wg.Wait()
}
