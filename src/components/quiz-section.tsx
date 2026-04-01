"use client"

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import questionsData from "@/data/questions.json"
import { cn } from "@/lib/utils"

type QuizQuestion = {
  id: number
  theme: string
  question: string
  options: string[]
  answer: string
  explanation: string
  wrong_answers?: Partial<Record<string, string>>
}

type QuizDataset = {
  quiz_title: string
  total_questions?: number
  questions: QuizQuestion[]
}

const quizSource = questionsData as QuizDataset
const quiz: Required<QuizDataset> = {
  ...quizSource,
  total_questions: quizSource.questions.length,
}
const QUESTIONS_PER_QUIZ = 10
const PROGRESS_STORAGE_KEY = "linux-qcm-question-progress-v1"

type QuestionStatus = "wrong" | "correct"

const LETTERS = ["A", "B", "C", "D"]

function pickRandomQuestions(questions: QuizQuestion[], limit: number) {
  const max = Math.min(limit, questions.length)
  const shuffled = [...questions].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, max)
}

function shuffleOptions(options: string[]) {
  return [...options].sort(() => Math.random() - 0.5)
}

function isCodeLike(value: string) {
  return (
    /^\//.test(value.trim()) ||
    value.includes("--") ||
    value.includes("$") ||
    value.includes(">>") ||
    /\b(apt|emerge|ip|top|ufw|tar|grep|chmod|chown|chgrp|swapon|pvcreate|read|hwclock|systemctl)\b/i.test(value) ||
    value.trim().startsWith("#!/")
  )
}

function InlineValue({ value }: { value: string }) {
  if (!isCodeLike(value)) {
    return <span>{value}</span>
  }

  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem]">{value}</code>
}

export function QuizSection() {
  const questionBankTotal = quiz.total_questions
  const [sessionQuestions, setSessionQuestions] = useState<QuizQuestion[]>(() =>
    pickRandomQuestions(quiz.questions, QUESTIONS_PER_QUIZ)
  )
  const questions = sessionQuestions
  const total = questions.length

  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)
  const [isQuestionPopupOpen, setIsQuestionPopupOpen] = useState(false)
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>(() => Array(sessionQuestions.length).fill(-1))
  const [questionStatusMap, setQuestionStatusMap] = useState<Record<number, QuestionStatus>>(() => {
    if (typeof window === "undefined") {
      return {}
    }

    try {
      const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
      if (!raw) return {}

      const parsed = JSON.parse(raw) as Record<string, QuestionStatus>
      return Object.entries(parsed).reduce<Record<number, QuestionStatus>>(
        (accumulator, [questionId, status]) => {
          if (status === "wrong" || status === "correct") {
            accumulator[Number(questionId)] = status
          }
          return accumulator
        },
        {}
      )
    } catch {
      return {}
    }
  })

  const currentQuestion = questions[currentIndex]
  const selectedAnswer = answers[currentIndex]
  const currentCorrectIndex = currentQuestion.options.findIndex(
    (option) => option === currentQuestion.answer
  )
  const hasAnsweredCurrent = selectedAnswer !== -1

  const score = useMemo(() => {
    return answers.reduce((accumulator, selected, index) => {
      if (selected === -1) return accumulator
      const correct = questions[index].options.findIndex(
        (option) => option === questions[index].answer
      )
      return selected === correct ? accumulator + 1 : accumulator
    }, 0)
  }, [answers, questions])

  const answeredCount = useMemo(() => answers.filter((value) => value !== -1).length, [answers])
  const wrongCount = answeredCount - score
  const progressValue = ((currentIndex + (hasAnsweredCurrent ? 1 : 0)) / total) * 100

  useEffect(() => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(questionStatusMap))
  }, [questionStatusMap])

  const selectAnswer = (optionIndex: number) => {
    if (hasAnsweredCurrent) return

    const nextAnswers = [...answers]
    nextAnswers[currentIndex] = optionIndex
    setAnswers(nextAnswers)

    const isCorrect = optionIndex === currentCorrectIndex
    setQuestionStatusMap((previous) => {
      const currentStatus = previous[currentQuestion.id]

      if (currentStatus === "correct") {
        return previous
      }

      return {
        ...previous,
        [currentQuestion.id]: isCorrect ? "correct" : "wrong",
      }
    })
  }

  const nextQuestion = () => {
    if (!hasAnsweredCurrent) return
    if (currentIndex === total - 1) {
      setFinished(true)
      return
    }
    setCurrentIndex((value) => value + 1)
  }

  const previousQuestion = () => {
    setCurrentIndex((value) => Math.max(0, value - 1))
  }

  const startQuizWithQuestions = (questionPool: QuizQuestion[]) => {
    const randomQuestions = pickRandomQuestions(questionPool, QUESTIONS_PER_QUIZ).map((question) => ({
      ...question,
      options: shuffleOptions(question.options),
    }))
    setSessionQuestions(randomQuestions)
    setStarted(true)
    setFinished(false)
    setCurrentIndex(0)
    setAnswers(Array(randomQuestions.length).fill(-1))
  }

  const startQuiz = () => {
    startQuizWithQuestions(quiz.questions)
  }

  const startUnseenQuiz = () => {
    const unseenQuestions = quiz.questions.filter((question) => !questionStatusMap[question.id])
    const source = unseenQuestions.length > 0 ? unseenQuestions : quiz.questions
    startQuizWithQuestions(source)
  }

  const startRetryFailedQuiz = () => {
    const failedQuestions = quiz.questions.filter(
      (question) => questionStatusMap[question.id] === "wrong"
    )

    if (failedQuestions.length === 0) {
      startQuiz()
      return
    }

    if (failedQuestions.length >= QUESTIONS_PER_QUIZ) {
      startQuizWithQuestions(failedQuestions)
      return
    }

    const failedQuestionIds = new Set(failedQuestions.map((question) => question.id))
    const extraQuestions = pickRandomQuestions(
      quiz.questions.filter((question) => !failedQuestionIds.has(question.id)),
      QUESTIONS_PER_QUIZ - failedQuestions.length
    )

    startQuizWithQuestions([...failedQuestions, ...extraQuestions])
  }

  const restartQuiz = () => {
    startQuiz()
  }

  const completedGlobalCount = Object.keys(questionStatusMap).length
  const correctGlobalCount = Object.values(questionStatusMap).filter(
    (status) => status === "correct"
  ).length
  const wrongGlobalCount = completedGlobalCount - correctGlobalCount
  const failedGlobalCount = wrongGlobalCount
  const unseenGlobalCount = questionBankTotal - completedGlobalCount
  const selectedQuestion = selectedQuestionId
    ? quiz.questions.find((question) => question.id === selectedQuestionId) ?? null
    : null
  const selectedQuestionStatus = selectedQuestion
    ? questionStatusMap[selectedQuestion.id]
    : undefined

  if (!started) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-3xl">
          <CardHeader className="gap-3 text-center">
            <CardTitle className="text-2xl sm:text-3xl">{quiz.quiz_title}</CardTitle>
            <CardDescription className="text-base">
              QCM de {total} questions aléatoires (banque: {questionBankTotal}), 4 réponses par question.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button size="lg" className="w-full max-w-xs" onClick={startQuiz}>
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (finished) {
    const percent = Math.round((score / total) * 100)

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-4xl">
          <CardHeader className="space-y-4 text-center">
            <CardTitle className="text-2xl sm:text-3xl">Quiz terminé</CardTitle>
            <CardDescription className="text-base">Voici ton résultat final.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Bonnes réponses</p>
                <p className="text-2xl font-semibold text-green-600">{score}</p>
              </div>
              <div className="rounded-xl border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Mauvaises réponses</p>
                <p className="text-2xl font-semibold text-red-600">{wrongCount}</p>
              </div>
              <div className="rounded-xl border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-semibold">{percent}%</p>
              </div>
            </div>

            <Progress value={percent} className="h-2" />

            <div className="flex justify-center">
              <Button onClick={restartQuiz} size="lg" className="w-full max-w-xs gap-2">
                <RotateCcw className="size-4" />
                Nouveau quiz aléatoire
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Card className="mx-auto w-full">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">{quiz.quiz_title}</p>
                <Button variant="ghost" size="sm" onClick={restartQuiz} className="h-7 gap-1 px-2">
                  <RotateCcw className="size-3.5" />
                  Reset QCM
                </Button>

                <Dialog open={isTrackerOpen} onOpenChange={setIsTrackerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
                      <Grid3X3 className="size-3.5" />
                      Suivi
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Suivi des questions</DialogTitle>
                      <DialogDescription>
                        Gris = non faite, rouge = réponse fausse, vert = réponse juste.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                      <div className="rounded-md border bg-muted/40 p-2">
                        <p className="text-muted-foreground">Faites</p>
                        <p className="text-sm font-semibold">{completedGlobalCount}/{questionBankTotal}</p>
                      </div>
                      <div className="rounded-md border border-green-500/40 bg-green-500/10 p-2">
                        <p className="text-muted-foreground">Justes</p>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">{correctGlobalCount}</p>
                      </div>
                      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2">
                        <p className="text-muted-foreground">Fausses</p>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">{wrongGlobalCount}</p>
                      </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto rounded-lg border p-3">
                      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
                        {quiz.questions.map((question) => {
                          const status = questionStatusMap[question.id]

                          return (
                            <button
                              key={question.id}
                              title={`Q${question.id} - ${question.theme}`}
                              onClick={() => {
                                setSelectedQuestionId(question.id)
                                setIsQuestionPopupOpen(true)
                              }}
                              className={cn(
                                "flex aspect-square items-center justify-center rounded-md border text-xs font-semibold transition-opacity hover:opacity-85",
                                !status && "border-border bg-muted/40 text-muted-foreground",
                                status === "wrong" && "border-red-500/50 bg-red-500/20 text-red-700 dark:text-red-300",
                                status === "correct" && "border-green-500/50 bg-green-500/20 text-green-700 dark:text-green-300"
                              )}
                            >
                              {question.id}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isQuestionPopupOpen}
                  onOpenChange={(open) => {
                    setIsQuestionPopupOpen(open)
                    if (!open) {
                      setSelectedQuestionId(null)
                    }
                  }}
                >
                  <DialogContent className="sm:max-w-2xl">
                    {selectedQuestion && (
                      <>
                        <DialogHeader>
                          <DialogTitle>Question {selectedQuestion.id}</DialogTitle>
                          <DialogDescription>{selectedQuestion.theme}</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                          <p className="text-base font-semibold sm:text-lg">{selectedQuestion.question}</p>

                          <div
                            className={cn(
                              "rounded-lg border p-3",
                              !selectedQuestionStatus && "border-border bg-muted/30",
                              selectedQuestionStatus === "wrong" &&
                              "border-red-500/40 bg-red-500/10",
                              selectedQuestionStatus === "correct" &&
                              "border-green-500/40 bg-green-500/10"
                            )}
                          >
                            <p className="text-sm text-muted-foreground">Ton statut</p>
                            <p
                              className={cn(
                                "font-medium",
                                !selectedQuestionStatus && "text-muted-foreground",
                                selectedQuestionStatus === "wrong" &&
                                "text-red-700 dark:text-red-300",
                                selectedQuestionStatus === "correct" &&
                                "text-green-700 dark:text-green-300"
                              )}
                            >
                              {!selectedQuestionStatus
                                ? "Non faite"
                                : selectedQuestionStatus === "correct"
                                  ? "Juste"
                                  : "Fausse"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3">
                            <p className="text-sm text-muted-foreground">Bonne réponse</p>
                            <p className="font-medium text-green-700 dark:text-green-300">
                              <InlineValue value={selectedQuestion.answer} />
                            </p>
                          </div>

                          <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-sm text-muted-foreground">Explication</p>
                            <p className="mt-1 text-sm leading-relaxed">{selectedQuestion.explanation}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startUnseenQuiz}
                  className="h-7 gap-1 px-2"
                >
                  <Sparkles className="size-3.5" />
                  Non faites ({unseenGlobalCount})
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startRetryFailedQuiz}
                  className="h-7 gap-1 px-2"
                  disabled={failedGlobalCount === 0}
                >
                  <RotateCcw className="size-3.5" />
                  Retry fail ({failedGlobalCount})
                </Button>
              </div>
              <CardTitle className="text-xl sm:text-2xl">Question {currentIndex + 1} / {total}</CardTitle>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="h-6 rounded-md px-2">
                <XCircle className="size-3.5" />
                {wrongCount}
              </Badge>
              <Badge className="h-6 rounded-md px-2">
                <CheckCircle2 className="size-3.5" />
                {score}
              </Badge>
            </div>
          </div>

          <Progress value={progressValue} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{currentQuestion.theme}</Badge>
          </div>

          <p className="text-lg leading-relaxed font-semibold sm:text-2xl">{currentQuestion.question}</p>

          <div className="grid gap-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrect = currentCorrectIndex === index

              const buttonClass = cn(
                "h-auto w-full justify-start gap-4 rounded-xl border px-4 py-4 text-left text-base sm:text-lg",
                !hasAnsweredCurrent && "hover:bg-muted",
                hasAnsweredCurrent && isCorrect && "border-green-600 bg-green-500/10",
                hasAnsweredCurrent && isSelected && !isCorrect && "border-red-600 bg-red-500/10",
                hasAnsweredCurrent && !isSelected && !isCorrect && "opacity-70"
              )

              const wrongExplanation =
                hasAnsweredCurrent && !isCorrect && currentQuestion.wrong_answers?.[option]

              return (
                <div key={`${currentQuestion.id}-${index}-${option}`} className="space-y-1">
                  <Button
                    variant="outline"
                    className={buttonClass}
                    onClick={() => selectAnswer(index)}
                    disabled={hasAnsweredCurrent}
                  >
                    <span className="w-8 shrink-0 text-muted-foreground">{LETTERS[index]}.</span>
                    <InlineValue value={option} />
                    {hasAnsweredCurrent && isCorrect && <CheckCircle2 className="ml-auto size-5 text-green-600" />}
                    {hasAnsweredCurrent && isSelected && !isCorrect && <XCircle className="ml-auto size-5 text-red-600" />}
                  </Button>
                  {wrongExplanation && (
                    <p className={cn(
                      "ml-12 text-sm leading-relaxed",
                      isSelected ? "text-red-600/80 dark:text-red-400/80" : "text-muted-foreground/70"
                    )}>
                      {wrongExplanation}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {hasAnsweredCurrent && (
            <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
              {selectedAnswer === currentCorrectIndex ? (
                <p className="font-medium text-green-700 dark:text-green-400">Bonne réponse ✅</p>
              ) : (
                <p className="font-medium text-red-700 dark:text-red-400">
                  Mauvaise réponse ❌ — Réponse correcte :{" "}
                  <InlineValue value={currentQuestion.options[currentCorrectIndex]} />
                </p>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={previousQuestion}
              disabled={currentIndex === 0}
              className="gap-2"
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>

            <Button onClick={nextQuestion} disabled={!hasAnsweredCurrent} className="gap-2">
              {currentIndex === total - 1 ? "Terminer" : "Suivant"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
