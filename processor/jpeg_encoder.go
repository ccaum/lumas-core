package processor

import (
  "fmt"
	"sync"
	. "github.com/3d0c/gmf"
)

func JpegEncoder(frame chan *Frame, wg *sync.WaitGroup, srcCtx *CodecCtx, timeBase AVR) {
  defer wg.Done()

  codec, err := FindEncoder(AV_CODEC_ID_JPEG2000)
	if err != nil {
		fatal(err)
	}

  cc := NewCodecCtx(codec)
  defer Release(cc)

  w, h := srcCtx.Width(), srcCtx.Height()

  cc.SetPixFmt(AV_PIX_FMT_RGB24).SetWidth(w).SetHeight(h).SetTimeBase(timeBase)

  if codec.IsExperimental() {
		cc.SetStrictCompliance(FF_COMPLIANCE_EXPERIMENTAL)
	}

	if err := cc.Open(nil); err != nil {
		fatal(err)
	}

  swsCtx := NewSwsCtx(srcCtx, cc, SWS_BICUBIC)
	defer Release(swsCtx)

  // convert to RGB, optionally resize could be here
	dstFrame := NewFrame().
		SetWidth(w).
		SetHeight(h).
		SetFormat(AV_PIX_FMT_RGB24)
	defer Release(dstFrame)

  if err := dstFrame.ImgAlloc(); err != nil {
		fatal(err)
	}

  for {
    srcFrame, ok := <-frame

    if !ok {
      break
    }

    swsCtx.Scale(srcFrame, dstFrame)
		//p, err := dstFrame.Encode(cc)
		if err == nil {
      fmt.Println("doing stuff in jpeg land")
		} else {
			Release(srcFrame)
			fatal(err)
		}
		Release(srcFrame)
  }
}

